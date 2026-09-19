import "server-only"
import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "./sessionCookie"

export { SESSION_COOKIE }
const MAX_AGE_SECONDS = 60 * 60 * 12

export type SesionUsuario = {
  id: string
  nombre: string
  rol: "conserje" | "admin"
  exp: number
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  // Sin secreto no se pueden firmar sesiones: fallar fuerte es preferible a
  // emitir cookies firmadas con un valor por defecto adivinable.
  if (!s) throw new Error("Falta SESSION_SECRET en las variables de entorno")
  return s
}

function firmar(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function crearToken(usuario: Omit<SesionUsuario, "exp">): string {
  const datos: SesionUsuario = { ...usuario, exp: Date.now() + MAX_AGE_SECONDS * 1000 }
  const payload = Buffer.from(JSON.stringify(datos)).toString("base64url")
  return `${payload}.${firmar(payload)}`
}

export function verificarToken(token: string | undefined | null): SesionUsuario | null {
  if (!token || !token.includes(".")) return null
  const [payload, firma] = token.split(".")
  try {
    const esperada = Buffer.from(firmar(payload))
    const recibida = Buffer.from(firma)
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString()) as SesionUsuario
    if (!datos.exp || datos.exp < Date.now()) return null
    return datos
  } catch {
    return null
  }
}

export async function getSesion(): Promise<SesionUsuario | null> {
  const store = await cookies()
  return verificarToken(store.get(SESSION_COOKIE)?.value)
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
}
