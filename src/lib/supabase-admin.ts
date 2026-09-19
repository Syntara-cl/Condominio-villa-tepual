import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente con service_role: solo server-side. Nunca importar desde un componente
// cliente — la key da acceso total saltándose RLS.
// Se crea al primer uso y no al importar el módulo: durante el build las
// variables de entorno pueden no estar presentes y createClient() lanzaría.
let cliente: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cliente) return cliente
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
  }
  cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return cliente
}
