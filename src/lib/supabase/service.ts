import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Bypasses RLS — only import this from server-only code that has no user
// session to authenticate as (the WhatsApp webhook). Never call this from
// a Server Action, Server Component render path, or anything a browser
// request could trigger.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
