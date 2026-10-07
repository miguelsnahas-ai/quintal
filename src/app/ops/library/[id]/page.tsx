import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getLibraryItem, getLibraryCategories } from "@/lib/ops/library";
import { cardClassName } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import LibraryItemFields from "../LibraryItemFields";
import { updateLibraryItemAction, archiveLibraryItemAction } from "../actions";

export default async function LibraryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;

  const [item, categories] = await Promise.all([getLibraryItem(id), getLibraryCategories()]);
  if (!item) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/library" className="text-sm text-ink-muted hover:text-ink">
          ← Biblioteca
        </Link>
        <h1 className="text-lg font-bold text-ink">{item.title}</h1>
        <p className="text-xs text-ink-muted">{item.id}</p>
      </div>

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      <form action={updateLibraryItemAction} className={cardClassName("space-y-4 p-4")}>
        <input type="hidden" name="id" value={item.id} />
        <LibraryItemFields
          categories={categories}
          defaults={{
            title: item.title,
            category: item.category,
            content: item.content,
            tags: item.tags,
            ageMinMonths: item.ageMinMonths,
            ageMaxMonths: item.ageMaxMonths,
            imageUrl: item.imageUrl,
            status: item.status,
          }}
        />
        <Button type="submit">Salvar</Button>
      </form>

      {item.status !== "archived" && (
        <form action={archiveLibraryItemAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" variant="danger">
            Arquivar
          </Button>
        </form>
      )}
    </div>
  );
}
