import Link from "next/link";
import { headers } from "next/headers";
import { Send, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { createFamily } from "./actions";

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const headersList = await headers();
  const origin = `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;
  const { data: families } = await supabase
    .from("families")
    .select("id, name, notes, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-ink">Famílias</h1>
        <p className="text-sm text-ink-muted">
          Cadastro das famílias atendidas pelo concierge.
        </p>
      </div>

      <section className={cardClassName("space-y-2 p-4")}>
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Send className="h-4 w-4 text-tertiary" aria-hidden />
          Link para pais testarem sozinhos
        </div>
        <p className="text-sm text-ink-muted">
          Mande este link para quem você quer que teste o Quintal — a pessoa
          cadastra a própria família e já começa a conversar, sem precisar
          de nada feito aqui antes.
        </p>
        <p className="truncate rounded-sm border border-neutral bg-secondary/40 px-3 py-2 text-sm text-ink">
          {origin}/comecar
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Adicionar família</h2>
        <form
          action={createFamily}
          className={cardClassName("flex flex-col gap-3 p-4 sm:flex-row sm:items-end")}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="name">Nome da família</Label>
            <Input id="name" name="name" required placeholder="ex: Família Silva" />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <Button type="submit">Criar</Button>
        </form>
        <FieldError>{error}</FieldError>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">
          {families?.length ?? 0} família(s)
        </h2>
        {!families || families.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Users className="h-8 w-8 text-ink-muted" aria-hidden />
            <p className="text-sm text-ink-muted">Nenhuma família cadastrada ainda.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-neutral">
            {families.map((family) => (
              <Link
                key={family.id}
                href={`/ops/families/${family.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="font-medium text-ink">{family.name}</span>
                {family.notes && (
                  <span className="truncate pl-4 text-ink-muted">{family.notes}</span>
                )}
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
