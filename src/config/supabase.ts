// Public browser configuration. The anon key is restricted by database RLS.
// Never place a service_role key, database password or server secret here.
export const publicSupabaseConfig = {
  url: "https://chcqmsccybrmgvzopxmw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoY3Ftc2NjeWJybWd2em9weG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MzYxNzcsImV4cCI6MjEwOTMxMjE3N30.7FQOYnr1kH_-S0mJWGAsKuTJ5FULlOZ6aOnupYEtpTI",
} as const
