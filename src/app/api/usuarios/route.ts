import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getSesion } from "@/lib/session"
import { hashPassword } from "@/lib/passwordHash"

const SELECT_SEGURO = "id, nombre, rut, rol, activo, intentos_fallidos, bloqueado_hasta, ultimo_acceso, created_at"

export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 })
  if (sesion.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 })

  const { data, error } = await getSupabaseAdmin()
    .from("usuarios")
    .select(SELECT_SEGURO)
    .order("nombre", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 })
  if (sesion.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const nombre = String(body?.nombre || "").trim()
  const rut = String(body?.rut || "").replace(/[.\-\s]/g, "").toUpperCase()
  const password = String(body?.password || "")
  const rol = body?.rol === "admin" ? "admin" : "conserje"

  if (!nombre || !rut) {
    return NextResponse.json({ error: "Nombre y RUT son obligatorios." }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from("usuarios")
    .insert({ nombre, rut, rol, password_hash: hashPassword(password) })
    .select(SELECT_SEGURO)

  if (error) {
    const mensaje = error.code === "23505" ? "Ya existe un usuario con ese RUT." : error.message
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
  return NextResponse.json({ success: true, data })
}
