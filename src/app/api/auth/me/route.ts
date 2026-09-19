import { NextResponse } from "next/server"
import { getSesion } from "@/lib/session"

export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 })
  return NextResponse.json({ id: sesion.id, nombre: sesion.nombre, rol: sesion.rol })
}
