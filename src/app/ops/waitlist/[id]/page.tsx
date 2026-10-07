import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightCircle, Check } from "lucide-react";
import { getLeadDetail, leadStatuses, leadStatusLabels } from "@/lib/ops/leads";
import { cardClassName } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, Label, FieldError } from "@/components/ui/Field";
import { saveLeadStatusAction, convertLeadAction } from "../actions";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function WaitlistLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;
  const lead = await getLeadDetail(id);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/waitlist" className="text-sm text-ink-muted hover:text-ink">
          ← Lista de interesse
        </Link>
        <h1 className="text-lg font-bold text-ink">{lead.name}</h1>
        <p className="text-sm text-ink-muted">
          Entrou em {new Date(lead.createdAt).toLocaleString("pt-BR")}
          {lead.origin && ` · origem: ${lead.origin}`}
        </p>
      </div>

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      <dl className={cardClassName("grid grid-cols-1 gap-4 p-4 sm:grid-cols-2")}>
        <DetailField label="E-mail" value={lead.email} />
        <DetailField label="WhatsApp" value={lead.whatsapp} />
      </dl>

      {lead.surveyAnswers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink">Histórico básico (respostas do formulário)</h2>
          <dl className={cardClassName("grid grid-cols-1 gap-4 p-4 sm:grid-cols-2")}>
            {lead.surveyAnswers.map((answer) => (
              <DetailField key={answer.label} label={answer.label} value={answer.value} />
            ))}
          </dl>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Status e observações</h2>
        <form action={saveLeadStatusAction} className={cardClassName("space-y-3 p-4")}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={lead.status} disabled={lead.status === "convertido"}>
              {leadStatuses.map((value) => (
                <option key={value} value={value}>
                  {leadStatusLabels[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Observações internas</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={lead.notes ?? ""}
              placeholder="Ex.: respondeu no WhatsApp, ainda decidindo, pediu para retomar em janeiro..."
            />
          </div>
          <Button type="submit" disabled={lead.status === "convertido"}>
            Salvar
          </Button>
        </form>
      </section>

      {lead.status === "convertido" ? (
        <p className="text-sm text-ink-muted">
          Já convertido
          {lead.convertedFamilyName && (
            <>
              {" "}
              para{" "}
              <Link href={`/ops/families/${lead.convertedFamilyId}`} className="underline hover:text-ink">
                {lead.convertedFamilyName}
              </Link>
            </>
          )}
          .
        </p>
      ) : (
        <form action={convertLeadAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <Button type="submit" variant="secondary">
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Converter em família
          </Button>
        </form>
      )}
    </div>
  );
}
