import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getSesion } from "@/lib/session"
import { hashPassword } from "@/lib/passwordHash"

const SELECT_SEGURO = "id, nombre, rut, rol, activo, intentos_fallidos, bloqueado_hasta, ultimo_acceso, created_at"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 })
  if (sesion.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 })

  const { id } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const cambios: Record<string, any> = {}

  if (typeof body?.activo === "boolean") {
    if (!body.activo && id === sesion.id) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta." }, { status: 400 })
    }
    cambios.activo = body.activo
  }
  if (body?.rol === "admin" || body?.rol === "conserje") {
    cambios.rol = body.rol
  }
  if (typeof body?.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 })
    }
    cambios.password_hash = hashPassword(body.password)
    cambios.intentos_fallidos = 0
    cambios.bloqueado_hasta = null
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from("usuarios")
    .update(cambios)
    .eq("id", id)
    .select(SELECT_SEGURO)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, data })
}
