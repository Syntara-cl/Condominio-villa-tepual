import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { verifyPassword } from "@/lib/passwordHash"
import { crearToken, cookieOptions, SESSION_COOKIE } from "@/lib/session"

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const rut = String(body?.rut || "").replace(/[.\-\s]/g, "").toUpperCase()
  const password = String(body?.password || "")
  if (!rut || !password) {
    return NextResponse.json({ error: "Ingresa tu RUT y contraseña." }, { status: 400 })
  }

  const { data: usuario, error: errorConsulta } = await getSupabaseAdmin()
    .from("usuarios")
    .select("id, nombre, rut, rol, password_hash, activo, intentos_fallidos, bloqueado_hasta")
    .eq("rut", rut)
    .maybeSingle()

  // Si la base no responde, decirlo: tratarlo como credencial inválida haría
  // que el conserje dude de su clave y la reintente hasta bloquearse la cuenta.
  if (errorConsulta) {
    return NextResponse.json(
      { error: "No se pudo conectar con el sistema. Avisa a la administración." },
      { status: 503 }
    )
  }

  // Mismo mensaje para usuario inexistente y clave incorrecta: distinguirlos
  // permitiría averiguar qué RUT tiene cuenta en el sistema.
  const credencialesInvalidas = NextResponse.json(
    { error: "RUT o contraseña incorrectos." }, { status: 401 }
  )

  if (!usuario || !usuario.activo) return credencialesInvalidas

  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    return NextResponse.json(
      { error: `Cuenta bloqueada temporalmente. Reintenta en ${BLOQUEO_MINUTOS} minutos.` },
      { status: 423 }
    )
  }

  if (!verifyPassword(usuario.password_hash, password)) {
    const intentos = (usuario.intentos_fallidos || 0) + 1
    await getSupabaseAdmin().from("usuarios").update({
      intentos_fallidos: intentos,
      bloqueado_hasta: intentos >= MAX_INTENTOS
        ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000).toISOString()
        : null,
    }).eq("id", usuario.id)
    return credencialesInvalidas
  }

  await getSupabaseAdmin().from("usuarios").update({
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    ultimo_acceso: new Date().toISOString(),
  }).eq("id", usuario.id)

  const token = crearToken({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol })
  const res = NextResponse.json({
    success: true,
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
  })
  res.cookies.set(SESSION_COOKIE, token, cookieOptions)
  return res
}
