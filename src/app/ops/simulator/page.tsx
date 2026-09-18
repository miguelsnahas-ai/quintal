import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { Label, Select, Textarea, FieldError } from "@/components/ui/Field";
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
        <h1 className="text-lg font-bold text-ink">Simulador de conversa</h1>
        <p className="text-sm text-ink-muted">
          Cria uma mensagem inbound falsa (marcada como simulação) para testar
          a triagem e as sugestões de IA sem precisar do WhatsApp configurado.
        </p>
      </div>

      <FieldError>{error}</FieldError>

      {!caregivers || caregivers.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhum cuidador cadastrado ainda. Cadastre uma família e um cuidador
          em /ops/families antes de simular uma mensagem.
        </p>
      ) : (
        <form action={simulateInboundMessage} className={cardClassName("space-y-4 p-4")}>
          <div className="space-y-1">
            <Label>De quem é a mensagem</Label>
            <Select name="caregiver_id" required defaultValue="">
              <option value="" disabled>
                Selecione um cuidador...
              </option>
              {caregivers.map((caregiver) => (
                <option key={caregiver.id} value={caregiver.id}>
                  {caregiver.name} ({caregiver.families?.name ?? "sem família"}) —{" "}
                  {caregiver.phone_number}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Mensagem simulada</Label>
            <Textarea
              name="body"
              required
              rows={4}
              placeholder="Ex: Oi! O bebê não parou de chorar a noite toda, não sei mais o que fazer."
            />
          </div>

          <Button type="submit">
            <Send className="h-4 w-4" aria-hidden />
            Simular mensagem e abrir triagem
          </Button>
        </form>
      )}
    </div>
  );
}
