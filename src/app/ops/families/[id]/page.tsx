import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ageLabel } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import {
  addCaregiver,
  addChild,
  deleteCaregiver,
  deleteChild,
  updateFamily,
} from "./actions";

export default async function FamilyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: familyId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: family }, { data: caregivers }, { data: children }] =
    await Promise.all([
      supabase
        .from("families")
        .select("id, name, notes")
        .eq("id", familyId)
        .maybeSingle(),
      supabase
        .from("caregivers")
        .select("id, name, role, phone_number, is_primary_contact")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("children")
        .select("id, name, birth_date, sex, notes")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
    ]);

  if (!family) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <FieldError>{error}</FieldError>

      <section className="space-y-3">
        <h1 className="text-lg font-bold text-ink">{family.name}</h1>
        <form action={updateFamily} className={cardClassName("space-y-3 p-4")}>
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <Label htmlFor="name">Nome da família</Label>
            <Input id="name" name="name" defaultValue={family.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={family.notes ?? ""} rows={3} />
          </div>
          <Button type="submit">Salvar</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Cuidadores</h2>

        {caregivers && caregivers.length > 0 && (
          <Card className="divide-y divide-neutral">
            {caregivers.map((caregiver) => (
              <div key={caregiver.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium text-ink">{caregiver.name}</span>
                  {caregiver.role && <span className="text-ink-muted"> · {caregiver.role}</span>}
                  {caregiver.is_primary_contact && (
                    <Badge className="ml-2">contato principal</Badge>
                  )}
                  <div className="text-ink-muted">{caregiver.phone_number}</div>
                </div>
                <form action={deleteCaregiver}>
                  <input type="hidden" name="family_id" value={family.id} />
                  <input type="hidden" name="caregiver_id" value={caregiver.id} />
                  <Button type="submit" variant="danger" className="px-2 py-1">
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remover
                  </Button>
                </form>
              </div>
            ))}
          </Card>
        )}

        <form
          action={addCaregiver}
          className={cardClassName("grid grid-cols-1 gap-3 p-4 sm:grid-cols-2")}
        >
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-1">
            <Label>Papel (mãe, pai, avó...)</Label>
            <Input name="role" />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp (formato +5511999999999)</Label>
            <Input name="phone_number" placeholder="+5511999999999" required />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input type="checkbox" name="is_primary_contact" defaultChecked />
            Contato principal
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Adicionar cuidador</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Crianças</h2>

        {children && children.length > 0 && (
          <Card className="divide-y divide-neutral">
            {children.map((child) => (
              <div key={child.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <Link
                    href={`/ops/children/${child.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {child.name}
                  </Link>
                  {ageLabel(child.birth_date) && (
                    <span className="text-ink-muted"> · {ageLabel(child.birth_date)}</span>
                  )}
                  {child.notes && <div className="text-ink-muted">{child.notes}</div>}
                </div>
                <form action={deleteChild}>
                  <input type="hidden" name="family_id" value={family.id} />
                  <input type="hidden" name="child_id" value={child.id} />
                  <Button type="submit" variant="danger" className="px-2 py-1">
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remover
                  </Button>
                </form>
              </div>
            ))}
          </Card>
        )}

        <form
          action={addChild}
          className={cardClassName("grid grid-cols-1 gap-3 p-4 sm:grid-cols-2")}
        >
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-1">
            <Label>Data de nascimento</Label>
            <Input type="date" name="birth_date" />
          </div>
          <div className="space-y-1">
            <Label>Sexo</Label>
            <Input name="sex" />
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input name="notes" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Adicionar criança</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
