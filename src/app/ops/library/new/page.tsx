import type { Metadata } from "next";
import Link from "next/link";
import { getLibraryCategories } from "@/lib/ops/library";
import { cardClassName } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import LibraryItemFields from "../LibraryItemFields";
import { createLibraryItemAction } from "../actions";

export const metadata: Metadata = {
  title: "Criar conteúdo — Biblioteca — Quintal Ops",
  robots: { index: false, follow: false },
};

export default async function NewLibraryItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const categories = await getLibraryCategories();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/library" className="text-sm text-ink-muted hover:text-ink">
          ← Biblioteca
        </Link>
        <h1 className="text-lg font-bold text-ink">Criar conteúdo</h1>
      </div>

      <FieldError>{error}</FieldError>

      <form action={createLibraryItemAction} className={cardClassName("space-y-4 p-4")}>
        <LibraryItemFields categories={categories} />
        <Button type="submit">Criar</Button>
      </form>
    </div>
  );
}
