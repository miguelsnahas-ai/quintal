import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createFamily } from "./actions";

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: families } = await supabase
    .from("families")
    .select("id, name, notes, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Famílias</h1>
        <p className="text-sm text-neutral-600">
          Cadastro das famílias atendidas pelo concierge.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">
          Adicionar família
        </h2>
        <form
          action={createFamily}
          className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">
              Nome da família
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="ex: Família Silva"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="notes" className="text-sm font-medium text-neutral-700">
              Notas (opcional)
            </label>
            <input
              id="notes"
              name="notes"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Criar
          </button>
        </form>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">
          {families?.length ?? 0} família(s)
        </h2>
        {!families || families.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma família cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {families.map((family) => (
              <li key={family.id}>
                <Link
                  href={`/ops/families/${family.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">
                    {family.name}
                  </span>
                  {family.notes && (
                    <span className="truncate pl-4 text-neutral-500">
                      {family.notes}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
