import { createClient } from "@/lib/supabase/server";
import { simulateInboundMessage } from "./actions";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: caregivers } = await supabase
    .from("caregivers")
    .select("id, name, phone_number, families(name)")
    .order("family_id", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Simulador de conversa
        </h1>
        <p className="text-sm text-neutral-600">
          Cria uma mensagem inbound falsa (marcada como simulação) para testar
          a triagem e as sugestões de IA sem precisar do WhatsApp configurado.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!caregivers || caregivers.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Nenhum cuidador cadastrado ainda. Cadastre uma família e um cuidador
          em /ops/families antes de simular uma mensagem.
        </p>
      ) : (
        <form
          action={simulateInboundMessage}
          className="space-y-4 rounded-md border border-neutral-200 bg-white p-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              De quem é a mensagem
            </label>
            <select
              name="caregiver_id"
              required
              defaultValue=""
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            >
              <option value="" disabled>
                Selecione um cuidador...
              </option>
              {caregivers.map((caregiver) => (
                <option key={caregiver.id} value={caregiver.id}>
                  {caregiver.name} ({caregiver.families?.name ?? "sem família"}) —{" "}
                  {caregiver.phone_number}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              Mensagem simulada
            </label>
            <textarea
              name="body"
              required
              rows={4}
              placeholder="Ex: Oi! O bebê não parou de chorar a noite toda, não sei mais o que fazer."
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Simular mensagem e abrir triagem
          </button>
        </form>
      )}
    </div>
  );
}
