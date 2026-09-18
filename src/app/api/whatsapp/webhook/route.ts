import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { isValidWebhookSignature } from "@/lib/whatsapp/verify";
import { webhookPayloadSchema, type WebhookMessage } from "@/lib/whatsapp/schema";

// Meta calls this once, at setup time, to confirm we control this URL.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

function extractBody(message: WebhookMessage): string | null {
  return message.type === "text" ? (message.text?.body ?? null) : null;
}

// WhatsApp expects a fast 2xx regardless of what we do internally — a
// non-2xx (or a timeout) makes it retry, and repeated failures can get the
// webhook subscription disabled. So every internal error is caught and
// logged rather than surfaced as a failed response.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");

  if (!appSecret || !isValidWebhookSignature(rawBody, signature, appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  const parsed = webhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ received: true });
  }

  // Everything below is best-effort: a config mistake or a transient DB
  // error must never bubble up as a non-2xx, or Meta starts retrying (and
  // eventually disables the subscription). Errors are logged, not thrown.
  try {
    const supabase = createServiceClient();

    for (const entry of parsed.data.entry ?? []) {
      for (const change of entry.changes) {
        for (const message of change.value.messages ?? []) {
          const fromPhoneNumber = `+${message.from}`;

          try {
            const { data: caregiver } = await supabase
              .from("caregivers")
              .select("id, family_id")
              .eq("phone_number", fromPhoneNumber)
              .maybeSingle();

            await supabase.from("messages").upsert(
              {
                wa_message_id: message.id,
                from_phone_number: fromPhoneNumber,
                direction: "inbound",
                message_type: message.type,
                body: extractBody(message),
                raw_payload: message as unknown as Json,
                wa_timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
                caregiver_id: caregiver?.id ?? null,
                family_id: caregiver?.family_id ?? null,
              },
              { onConflict: "wa_message_id", ignoreDuplicates: true },
            );
          } catch (error) {
            console.error("Failed to store WhatsApp message", message.id, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to process WhatsApp webhook payload", error);
  }

  return NextResponse.json({ received: true });
}
