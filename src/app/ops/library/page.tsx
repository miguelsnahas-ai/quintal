import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { getLibraryList, getLibraryCategories, libraryStatuses, libraryStatusLabels, type LibraryStatus } from "@/lib/ops/library";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Biblioteca — Quintal Ops",
  robots: { index: false, follow: false },
};

const STATUS_BADGE_VARIANT: Record<LibraryStatus, "neutral" | "accent" | "success" | "decorative"> = {
  published: "success",
  draft: "neutral",
  archived: "decorative",
};

// Versão simplificada da Biblioteca (refatoração do /ops) — gestão do
// mesmo knowledge_chunks que alimenta recomendações/métodos alimentares/
// receitas em produção (src/lib/library.ts), nunca uma segunda base de
// conteúdo. Paginado (531 linhas hoje) — busca/filtro/página via query
// string, mesmo padrão GET-only do resto do produto.
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  const { q, category, status, page } = await searchParams;
  const statusFilter = libraryStatuses.includes(status as LibraryStatus) ? (status as LibraryStatus) : undefined;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;

  const [{ items, total, pageCount }, categories] = await Promise.all([
    getLibraryList({ query: q, category, status: statusFilter, page: pageNumber }),
    getLibraryCategories(),
  ]);

  const queryString = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    const str = params.toString();
    return str ? `?${str}` : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Biblioteca</h1>
          <p className="text-sm text-ink-muted">{total} conteúdo(s) — o que alimenta as recomendações do Quintal.</p>
        </div>
        <Link href="/ops/library/new" className={buttonClassName("primary")}>
          <Plus className="h-4 w-4" aria-hidden />
          Criar conteúdo
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="q">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Título" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="category">
            Categoria
          </label>
          <Select id="category" name="category" defaultValue={category ?? ""}>
            <option value="">Todas</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todos</option>
            {libraryStatuses.map((value) => (
              <option key={value} value={value}>
                {libraryStatusLabels[value]}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className="sr-only">
          Filtrar
        </button>
      </form>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <BookOpen className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">Nenhum conteúdo encontrado.</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral text-xs text-ink-muted">
                  <th className="px-4 py-2.5 font-medium">Conteúdo</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-secondary/60">
                    <td className="px-4 py-3">
                      <Link href={`/ops/library/${item.id}`} className="font-medium text-ink hover:underline">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{item.typeLabel}</td>
                    <td className="px-4 py-3 text-ink-muted">{item.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{libraryStatusLabels[item.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-2 text-sm">
              {pageNumber > 1 && (
                <Link href={queryString({ page: pageNumber - 1 })} className="text-ink-muted hover:text-ink">
                  ← Anterior
                </Link>
              )}
              <span className="text-ink-muted">
                Página {pageNumber} de {pageCount}
              </span>
              {pageNumber < pageCount && (
                <Link href={queryString({ page: pageNumber + 1 })} className="text-ink-muted hover:text-ink">
                  Próxima →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
