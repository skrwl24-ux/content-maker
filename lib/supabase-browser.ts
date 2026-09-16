import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://ygrgamfvykuyhijogxou.supabase.co";
const fallbackPublishableKey = "sb_publishable_FPIPh89R0_78FfWzagT7hw_PGWSNE21";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackPublishableKey;
  return createClient(url, key);
}

export async function ensureAnonymousSession() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return { supabase, session: data.session };

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!signInData.session) throw new Error("Anonymous sign-in failed.");
  return { supabase, session: signInData.session };
}
