import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

const SESSION_COOKIE = "quintal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

// Minimal session for the real product experience (/quintal): an opaque,
// unguessable token (never the caregiverId itself) in an httpOnly cookie,
// resolved server-side against caregiver_sessions. This is deliberately
// NOT a full auth system (no login/password/OTP/email) — see
// docs/ARCHITECTURE_TARGET.md for why this is the minimal secure
// alternative for this phase and what a definitive solution would add.
// /test/[caregiverId] is untouched by this and keeps trusting the id in
// its URL — it's an internal tool whose link only the operator shares.
export async function createFamilySession(caregiverId: string): Promise<void> {
  const supabase = createServiceClient();
  const token = randomUUID();

  const { error } = await supabase
    .from("caregiver_sessions")
    .insert({ token, caregiver_id: caregiverId });

  if (error) {
    throw new Error(error.message);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getFamilySessionCaregiverId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("caregiver_sessions")
    .select("caregiver_id")
    .eq("token", token)
    .maybeSingle();

  return data?.caregiver_id ?? null;
}
