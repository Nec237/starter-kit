import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from './supabase-env';

let client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  client ??= createClient(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
