"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const simulateInputSchema = z.object({
  caregiver_id: z.uuid("Selecione um cuidador."),
  body: z.string().trim().min(1, "Escreva a mensagem simulada."),
});

export async function simulateInboundMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = simulateInputSchema.safeParse({
    caregiver_id: formData.get("caregiver_id"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(`/ops/simulator?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { data: caregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .select("id, family_id, phone_number")
    .eq("id", parsed.data.caregiver_id)
    .maybeSingle();

  if (caregiverError || !caregiver) {
    redirect(`/ops/simulator?error=${encodeURIComponent("Cuidador não encontrado.")}`);
  }

  // "sim-" marks this as a simulated message everywhere it's displayed
  // (inbox, triagem) — a real WhatsApp id never starts with it, so this
  // is a safe, no-schema-change way to flag "não é uma conversa real,
  // cuidado antes de enviar de verdade" once o envio pelo WhatsApp
  // estiver configurado.
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      wa_message_id: `sim-${randomUUID()}`,
      from_phone_number: caregiver.phone_number,
      direction: "inbound",
      message_type: "text",
      body: parsed.data.body,
      raw_payload: { simulated: true } as Json,
      wa_timestamp: new Date().toISOString(),
      family_id: caregiver.family_id,
      caregiver_id: caregiver.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect(
      `/ops/simulator?error=${encodeURIComponent(insertError?.message ?? "Falha ao simular mensagem.")}`,
    );
  }

  redirect(`/ops/inbox/${inserted.id}`);
}
