import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ageLabel } from "@/lib/format";
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
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h1 className="text-lg font-semibold text-neutral-900">{family.name}</h1>
        <form
          action={updateFamily}
          className="space-y-3 rounded-md border border-neutral-200 bg-white p-4"
        >
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">
              Nome da família
            </label>
            <input
              id="name"
              name="name"
              defaultValue={family.name}
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="notes" className="text-sm font-medium text-neutral-700">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={family.notes ?? ""}
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Salvar
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">Cuidadores</h2>

        {caregivers && caregivers.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {caregivers.map((caregiver) => (
              <li
                key={caregiver.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-neutral-900">
                    {caregiver.name}
                  </span>
                  {caregiver.role && (
                    <span className="text-neutral-500"> · {caregiver.role}</span>
                  )}
                  {caregiver.is_primary_contact && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      contato principal
                    </span>
                  )}
                  <div className="text-neutral-500">{caregiver.phone_number}</div>
                </div>
                <form action={deleteCaregiver}>
                  <input type="hidden" name="family_id" value={family.id} />
                  <input type="hidden" name="caregiver_id" value={caregiver.id} />
                  <button
                    type="submit"
                    className="text-neutral-400 hover:text-red-600"
                  >
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addCaregiver}
          className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Nome</label>
            <input
              name="name"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              Papel (mãe, pai, avó...)
            </label>
            <input
              name="role"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              WhatsApp (formato +5511999999999)
            </label>
            <input
              name="phone_number"
              placeholder="+5511999999999"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-700">
            <input type="checkbox" name="is_primary_contact" defaultChecked />
            Contato principal
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Adicionar cuidador
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">Crianças</h2>

        {children && children.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-neutral-900">{child.name}</span>
                  {ageLabel(child.birth_date) && (
                    <span className="text-neutral-500"> · {ageLabel(child.birth_date)}</span>
                  )}
                  {child.notes && (
                    <div className="text-neutral-500">{child.notes}</div>
                  )}
                </div>
                <form action={deleteChild}>
                  <input type="hidden" name="family_id" value={family.id} />
                  <input type="hidden" name="child_id" value={child.id} />
                  <button
                    type="submit"
                    className="text-neutral-400 hover:text-red-600"
                  >
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addChild}
          className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="family_id" value={family.id} />
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Nome</label>
            <input
              name="name"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              Data de nascimento
            </label>
            <input
              type="date"
              name="birth_date"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Sexo</label>
            <input
              name="sex"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Notas</label>
            <input
              name="notes"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Adicionar criança
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
