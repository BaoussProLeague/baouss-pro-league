import { createClient } from "@supabase/supabase-js";

// Service-role client: full read/write, ONLY ever imported from pages/api/*
// Never import supabaseAdmin into a component that ships to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Anon client: safe for read-only queries from the browser, respects RLS policies
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
