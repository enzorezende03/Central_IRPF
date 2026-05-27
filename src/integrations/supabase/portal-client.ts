import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Dedicated Supabase client for the passwordless client portal.
// Sends `x-portal-token` / `x-portal-slug` headers so that RLS policies
// on anon writes (case_pendencias, document_requests, final_deliverables,
// case_timeline, case_messages, case_answers, uploaded_documents) can
// verify that the target case_id belongs to the portal the user opened.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

let cached: { key: string; client: SupabaseClient<Database> } | null = null;

export function createPortalClient(
  token: string | null | undefined,
  slug: string | null | undefined,
): SupabaseClient<Database> {
  const key = `${token ?? ""}|${slug ?? ""}`;
  if (cached && cached.key === key) return cached.client;

  const headers: Record<string, string> = {};
  if (token) headers["x-portal-token"] = token;
  if (slug) headers["x-portal-slug"] = slug;

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "sb-portal",
    },
    global: { headers },
  });

  cached = { key, client };
  return client;
}

export function getPortalClient(): SupabaseClient<Database> | null {
  return cached?.client ?? null;
}
