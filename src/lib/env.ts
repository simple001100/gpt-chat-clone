function getEnvValue(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getSupabaseUrl() {
  return getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return getEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
}

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || getEnvValue("GEMENI_API_KEY");
}

export function getGeminiDefaultModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}
