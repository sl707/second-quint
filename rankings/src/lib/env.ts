function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};

export function serverEnv() {
  return {
    supabaseSecretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}
