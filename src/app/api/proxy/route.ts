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
    // Borrar un ingreso falsearía el libro de portería: solo la administración.
    // El conserje corrige con update (queda en audit_log).
    delete: ["admin"],
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

// Columnas que se pueden usar en filtros y orden, por tabla. Evita filtrar por
// columnas ajenas o con rutas de relación (ej. usuarios.password_hash).
const COLUMNAS: Record<string, string[]> = {
  logs_porteria: [
    "id", "residente_id", "visita_frecuente_id", "nombre_manual", "rut_manual", "unidad_destino",
    "motivo", "patente", "acceso", "fecha", "hora_ingreso", "hora_salida", "observacion", "created_at",
  ],
  residentes: ["id", "nombre", "apellido", "rut", "unidad", "tipo", "telefono", "email", "patente_default", "activo", "created_at"],
  visitas_frecuentes: [
    "id", "nombre", "apellido", "rut", "tipo_servicio", "unidad_destino", "autorizado_por", "patente_default", "activo", "created_at",
  ],
  porteria_patentes: ["id", "residente_id", "visita_frecuente_id", "patente", "activo", "created_at"],
}

const LIMITE_MAX = 5000

const OPERADORES = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"] as const

// Update y delete actúan sobre un único registro, identificado por su id (uuid).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function idValido(match: unknown): match is { id: string } {
  if (!match || typeof match !== "object") return false
  const m = match as Record<string, unknown>
  return Object.keys(m).length === 1 && typeof m.id === "string" && UUID.test(m.id)
}

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
          if (!COLUMNAS[table].includes(f?.column) || !OPERADORES.includes(f.operator)) {
            return NextResponse.json({ error: "Filtro inválido." }, { status: 400 })
          }
          query = query.filter(f.column, f.operator, f.value)
        }
      }
      if (typeof order === "string") {
        const [col, dir] = order.split(":")
        if (!COLUMNAS[table].includes(col)) {
          return NextResponse.json({ error: "Orden inválido." }, { status: 400 })
        }
        query = query.order(col, { ascending: dir !== "desc" })
      }
      if (typeof limit === "number") query = query.limit(Math.min(Math.max(Math.floor(limit), 1), LIMITE_MAX))

      resultado = await query
    } else if (method === "insert") {
      // El autor del registro lo pone el servidor a partir de la sesión: si viniera
      // del cliente, cualquiera podría firmar un movimiento a nombre de otro conserje.
      const payload = Array.isArray(data) ? data : [data]
      if (payload.length === 0 || payload.some((fila: any) => !fila || typeof fila !== "object" || Array.isArray(fila))) {
        return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
      }
      const conAutor = payload.map((fila: any) => {
        const limpio = { ...fila }
        delete limpio.registrado_por_id
        delete limpio.salida_por_id
        if (table !== "logs_porteria") return limpio
        // La fecha la calcula la BD desde hora_ingreso; una salida registrada al crear se firma igual.
        delete limpio.fecha
        return {
          ...limpio,
          registrado_por_id: sesion.id,
          ...(limpio.hora_salida ? { salida_por_id: sesion.id } : {}),
        }
      })
      resultado = await getSupabaseAdmin().from(table).insert(conAutor).select()
    } else if (method === "update") {
      if (!idValido(match)) {
        return NextResponse.json({ error: "Falta el identificador del registro a actualizar." }, { status: 400 })
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
      }
      const limpio = { ...data }
      delete limpio.registrado_por_id
      delete limpio.salida_por_id
      if (table === "logs_porteria") delete limpio.fecha
      // Registrar la salida es lo único que firma el servidor en un update.
      if (table === "logs_porteria" && data?.hora_salida) limpio.salida_por_id = sesion.id
      resultado = await getSupabaseAdmin().from(table).update(limpio).match(match).select()
    } else {
      if (!idValido(match)) {
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
