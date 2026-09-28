import Link from "next/link";
import { FileText, Video, BookOpen, Compass, CheckSquare, Sparkles, UtensilsCrossed, BookMarked } from "lucide-react";
import { getMaterialHref, type LibraryMaterial } from "@/lib/library";
import { materialTypeLabels, materialCategoryLabels, type MaterialType } from "@/lib/validation/library";

const TYPE_ICONS: Record<MaterialType, typeof FileText> = {
  article: FileText,
  video: Video,
  book: BookOpen,
  guide: Compass,
  checklist: CheckSquare,
  activity: Sparkles,
  recipe: UtensilsCrossed,
  reference: BookMarked,
};

// Mesmo espírito visual de ActivityCard/MealSuggestionCard (rounded-lg,
// bg-secondary, sem borda) — um material deve parecer um convite a
// abrir, não uma linha de tabela. `reason` é opcional: só as
// "Recomendadas para vocês" (Fase 12) têm um motivo, um resultado de
// busca/filtro não precisa de um.
export default function MaterialCard({ material, reason }: { material: LibraryMaterial; reason?: string }) {
  const Icon = TYPE_ICONS[material.type];

  return (
    <Link
      href={getMaterialHref(material)}
      className="block rounded-lg bg-secondary p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start gap-3">
        {material.imageUrl ? (
          // External Drive-hosted URL, not a local/optimizable asset (see activity.ts).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={material.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <Icon className="h-4 w-4 text-ink" aria-hidden />
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-ink">{material.title}</p>
          <p className="text-xs text-ink-muted">
            {materialTypeLabels[material.type]} · {materialCategoryLabels[material.category]}
            {material.ageDisplayLabel ? ` · ${material.ageDisplayLabel}` : ""}
          </p>
          {reason && <p className="text-xs text-ink-muted">{reason}</p>}
        </div>
      </div>
    </Link>
  );
}
