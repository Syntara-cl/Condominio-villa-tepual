import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getSesion, type SesionUsuario } from "@/lib/session"

type Metodo = "select" | "insert" | "update" | "delete"
type Rol = SesionUsuario["rol"]

// Qué rol puede hacer qué sobre cada tabla. El conserje registra movimientos y
// memoriza patentes; los catálogos (residentes, visitas frecuentes) los mantiene
// la administración.
const PERMISOS: Record<string, Record<Metodo, Rol[]>> = {
  logs_porteria: {
    select: ["conserje", "admin"],
    insert: ["conserje", "admin"],
    update: ["conserje", "admin"],
    delete: ["conserje", "admin"],
  },
  residentes: {
    select: ["conserje", "admin"],
    insert: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  },
  visitas_frecuentes: {
    select: ["conserje", "admin"],
    insert: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  },
  porteria_patentes: {
    select: ["conserje", "admin"],
    insert: ["conserje", "admin"],
    update: ["conserje", "admin"],
    delete: ["admin"],
  },
}

// Un select con relaciones embebidas puede arrastrar columnas sensibles de otra
// tabla (ej. usuarios.password_hash), así que las únicas formas con paréntesis
// permitidas son estas, exactas.
const SELECTS_CON_JOIN: Record<string, string[]> = {
  logs_porteria: [
    "*, residente:residentes(nombre, apellido, rut, unidad), registrado_por:usuarios!registrado_por_id(nombre), salida_por:usuarios!salida_por_id(nombre)",
    "*, residente:residentes(nombre, apellido, unidad), registrado_por:usuarios!registrado_por_id(nombre), salida_por:usuarios!salida_por_id(nombre)",
  ],
}

const OPERADORES = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"] as const

function selectValido(tabla: string, data: unknown): data is string | undefined {
  if (data === undefined || data === null) return true
  if (typeof data !== "string") return false
  if (data.includes("(")) return (SELECTS_CON_JOIN[tabla] || []).includes(data)
  return /^[a-zA-Z0-9_,.\s*]+$/.test(data)
}

export async function POST(request: Request) {
  const sesion = await getSesion()
  if (!sesion) {
    return NextResponse.json({ error: "Sesión expirada. Vuelve a iniciar sesión." }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const { table, method, data, filters, match, order, limit } = body || {}

  const permisosTabla = PERMISOS[table]
  if (!permisosTabla) {
    return NextResponse.json({ error: `Tabla no permitida: ${table}` }, { status: 403 })
  }
  if (!["select", "insert", "update", "delete"].includes(method)) {
    return NextResponse.json({ error: `Método no permitido: ${method}` }, { status: 403 })
  }
  if (!permisosTabla[method as Metodo].includes(sesion.rol)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 })
  }

  try {
    let resultado: any

    if (method === "select") {
      if (!selectValido(table, data)) {
        return NextResponse.json({ error: "Selección de columnas no permitida." }, { status: 403 })
      }
      let query = getSupabaseAdmin().from(table).select(typeof data === "string" ? data : "*")

      if (Array.isArray(filters)) {
        for (const f of filters) {
          if (!f?.column || !OPERADORES.includes(f.operator)) {
            return NextResponse.json({ error: "Filtro inválido." }, { status: 400 })
          }
          query = query.filter(f.column, f.operator, f.value)
        }
      }
      if (typeof order === "string") {
        const [col, dir] = order.split(":")
        query = query.order(col, { ascending: dir !== "desc" })
      }
      if (typeof limit === "number") query = query.limit(limit)

      resultado = await query
    } else if (method === "insert") {
      // El autor del registro lo pone el servidor a partir de la sesión: si viniera
      // del cliente, cualquiera podría firmar un movimiento a nombre de otro conserje.
      const payload = Array.isArray(data) ? data : [data]
      const conAutor = payload.map((fila: any) => {
        const limpio = { ...fila }
        delete limpio.registrado_por_id
        delete limpio.salida_por_id
        return table === "logs_porteria" ? { ...limpio, registrado_por_id: sesion.id } : limpio
      })
      resultado = await getSupabaseAdmin().from(table).insert(conAutor).select()
    } else if (method === "update") {
      if (!match || typeof match !== "object" || Object.keys(match).length === 0) {
        return NextResponse.json({ error: "Falta el identificador del registro a actualizar." }, { status: 400 })
      }
      const limpio = { ...data }
      delete limpio.registrado_por_id
      delete limpio.salida_por_id
      // Registrar la salida es lo único que firma el servidor en un update.
      if (table === "logs_porteria" && data?.hora_salida) limpio.salida_por_id = sesion.id
      resultado = await getSupabaseAdmin().from(table).update(limpio).match(match).select()
    } else {
      if (!match || typeof match !== "object" || Object.keys(match).length === 0) {
        return NextResponse.json({ error: "Falta el identificador del registro a eliminar." }, { status: 400 })
      }
      resultado = await getSupabaseAdmin().from(table).delete().match(match).select()
    }

    if (resultado.error) {
      return NextResponse.json({ error: resultado.error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: resultado.data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado." }, { status: 500 })
  }
}
