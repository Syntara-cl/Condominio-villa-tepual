import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Fecha visible al usuario: siempre dd/mm/aa. */
export function formatFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return ""

  if (fecha instanceof Date) {
    const day = String(fecha.getDate()).padStart(2, '0')
    const month = String(fecha.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${String(fecha.getFullYear()).slice(2)}`
  }

  if (fecha.includes("/")) {
    const parts = fecha.split("/")
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`
    }
    return fecha
  }

  const datePart = fecha.split("T")[0]
  const parts = datePart.split("-")
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts
    return `${day}/${month}/${year.slice(2)}`
  }

  return fecha
}

/** Hora en 24h (`14:30`), convención chilena. */
export function formatHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return ""
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return ""
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Hora de Chile en 24h a partir de un timestamp UTC. */
export function formatHoraChile(fecha: string | Date | null | undefined): string {
  if (!fecha) return ""
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false
  })
}

/** Fecha para nombres de archivo: dd-mm-aaaa. */
export function formatFechaArchivo(fecha?: Date | string | null): string {
  const valor = fecha ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  if (valor instanceof Date) {
    const day = String(valor.getDate()).padStart(2, '0')
    const month = String(valor.getMonth() + 1).padStart(2, '0')
    return `${day}-${month}-${valor.getFullYear()}`
  }
  const isoMatch = valor.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return day ? `${day}-${month}-${year}` : `${month}-${year}`
  }
  return valor
}

/** Día calendario en Chile (YYYY-MM-DD) de un timestamp. */
export function getChileDateStr(dateVal: string | Date | null): string {
  if (!dateVal) return ""
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  } catch {
    return ""
  }
}

/** Patentes: solo letras/números, sin guión ni espacios, máximo 6 caracteres. */
export function sanitizePatente(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
