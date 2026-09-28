import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMaterial } from "@/lib/library";
import { materialTypeLabels, materialCategoryLabels } from "@/lib/validation/library";

// Pública por design — mesmo nível de /atividades/[id] (Fase 4): conteúdo
// de referência, nada pessoal, alguém pode abrir de um link direto sem
// sessão.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const material = await getMaterial(id);
  return {
    title: material ? `${material.title} — Quintal` : "Material — Quintal",
    robots: { index: false, follow: false },
  };
}

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getMaterial(id);

  if (!material) {
    notFound();
  }

  // brincadeiras/materiais (categoria de conhecimento) já têm sua
  // própria página de detalhe (Activity, Fase 4/11) — nunca duas
  // páginas para o mesmo conteúdo.
  if (material.sourceCategory === "brincadeiras" || material.sourceCategory === "materiais") {
    redirect(`/atividades/${material.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      {material.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={material.imageUrl}
          alt={material.title}
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      )}
      <div className="space-y-1">
        <p className="text-xs font-medium text-ink-muted">
          {materialTypeLabels[material.type]} · {materialCategoryLabels[material.category]}
        </p>
        <h1 className="text-xl font-bold text-ink">{material.title}</h1>
        {material.ageDisplayLabel && (
          <p className="text-sm text-ink-muted">{material.ageDisplayLabel}</p>
        )}
      </div>

      {material.description && <Section title="Resumo" text={material.description} />}
      {material.extra.map((detail) => (
        <Section key={detail.label} title={detail.label} text={detail.value} />
      ))}

      <p className="text-xs text-ink-muted">
        Conteúdo de referência geral — dúvidas específicas valem uma conversa com o pediatra ou
        outro profissional de confiança da família.
      </p>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg bg-secondary p-4">
      <h2 className="mb-1 text-sm font-semibold text-ink">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
    </section>
  );
}
