import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockClient(): SupabaseClient {
  const noop = () => {};
  const noopPromise = async () => ({ data: { user: null }, error: null });
  return {
    auth: {
      getUser: noopPromise,
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
      signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: { message: "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local" } }),
      signInWithOtp: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), upsert: () => Promise.resolve({ error: null }) }),
  } as unknown as SupabaseClient;
}

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://placeholder.supabase.co") {
    return createMockClient();
  }
  return createBrowserClient(url, key);
}
