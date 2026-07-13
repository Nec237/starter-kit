export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function requireSupabaseUrl(): string {
  const value = getSupabaseUrl();
  if (!value) throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  return value;
}

export function requireSupabaseServiceRoleKey(): string {
  const value = getSupabaseServiceRoleKey();
  if (!value) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return value;
}
