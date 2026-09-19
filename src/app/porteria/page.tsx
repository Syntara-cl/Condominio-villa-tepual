"use client"
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Shield, Search, LogIn, LogOut, UserPlus, Clock, Loader2,
  User, Users, RefreshCw, FileSpreadsheet, Download, Home,
  Users2, UserSquare2, CalendarDays, ChevronLeft, ChevronRight,
  Edit2, Trash2, Power
} from "lucide-react"
import { Button } from "@/components/uib/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/uib/card"
import { Input } from "@/components/uib/input"
import { Badge } from "@/components/uib/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger
} from "@/components/uib/dialog"
import { Label } from "@/components/uib/label"
import { toast } from "sonner"
import { cn, formatFecha, formatHoraChile, getChileDateStr, sanitizePatente } from "@/lib/utils"
import { exportExcel } from "@/lib/export-excel"

const VERDE = '#2D6A4F'
const VERDE_OSCURO = '#245740'

type TipoPersona = 'residente' | 'visita_frecuente'

const getCalendarWeeks = () => {
  const weeks: Array<{ label: string; start: Date; end: Date }> = []
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  let currentStart = new Date(startOfMonth)
  currentStart.setHours(0, 0, 0, 0)

  while (currentStart <= now) {
    const currentDay = currentStart.getDay()
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
    const currentEnd = new Date(currentStart)
    currentEnd.setDate(currentStart.getDate() + daysToSunday)
    currentEnd.setHours(23, 59, 59, 999)
    if (currentEnd > now) currentEnd.setTime(now.getTime())

    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
    const isCurrent = now >= currentStart && now <= currentEnd

    weeks.push({
      label: isCurrent
        ? `Semana actual (${fmt(currentStart)} al ${fmt(currentEnd)})`
        : `Semana del ${fmt(currentStart)} al ${fmt(currentEnd)}`,
      start: new Date(currentStart),
      end: new Date(currentEnd)
    })

    const trueSunday = new Date(currentStart)
    trueSunday.setDate(currentStart.getDate() + daysToSunday)
    const nextMonday = new Date(trueSunday)
    nextMonday.setDate(trueSunday.getDate() + 1)
    nextMonday.setHours(0, 0, 0, 0)
    currentStart = nextMonday
  }
  return weeks.reverse()
}

const toISODate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Se filtra por `hora_ingreso` (timestamp real) y no por la columna `fecha`, que
// puede quedar desalineada un día en ingresos cercanos a medianoche.
const chileDayBoundsISO = (dateStr: string) => ({
  startISO: new Date(dateStr + 'T00:00:00').toISOString(),
  endISO: new Date(dateStr + 'T23:59:59.999').toISOString()
})

// Bloques de 5 días para no exceder el límite de filas por consulta en rangos largos.
const buildDateBlocks = (startStr: string, endStr: string): Array<{ start: string; end: string }> => {
  const blocks: Array<{ start: string; end: string }> = []
  let cursor = new Date(startStr + 'T00:00:00')
  const rangeEnd = new Date(endStr + 'T00:00:00')
  while (cursor <= rangeEnd) {
    const blockEnd = new Date(cursor)
    blockEnd.setDate(blockEnd.getDate() + 4)
    if (blockEnd > rangeEnd) blockEnd.setTime(rangeEnd.getTime())
    blocks.push({ start: toISODate(cursor), end: toISODate(blockEnd) })
    cursor = new Date(blockEnd)
    cursor.setDate(cursor.getDate() + 1)
  }
  return blocks
}

const isoToDDMM = (iso: string) => {
  const [, mm, dd] = iso.split('-')
  return `${dd}/${mm}`
}

// Muestra la hora de Chile en un <input type="datetime-local">, no la del navegador.
const isoToChileLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

// Inverso: "YYYY-MM-DDTHH:mm" en hora de Chile → ISO UTC real, calculando el
// offset vigente (-03/-04) para ese instante específico.
const chileLocalInputToISO = (value: string): string | null => {
  if (!value) return null
  const guessUTC = new Date(value + ':00.000Z')
  if (isNaN(guessUTC.getTime())) return null
  const chileStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(guessUTC)
  const chileAsUTC = new Date(chileStr.replace(', ', 'T') + '.000Z')
  const offsetMs = guessUTC.getTime() - chileAsUTC.getTime()
  return new Date(guessUTC.getTime() + offsetMs).toISOString()
}

const proxy = async (payload: Record<string, unknown>) => {
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok || result.error) throw new Error(result.error || 'No se pudo completar la acción.')
  return result
}

const MESES_CALENDARIO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_CALENDARIO = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function DateRangeCalendar({ start, end, onChange }: {
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
}) {
  const [viewDate, setViewDate] = useState(() => {
    const base = start ? new Date(start + 'T00:00:00') : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [hoverISO, setHoverISO] = useState<string | null>(null)

  const days = React.useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    let firstDay = new Date(year, month, 1).getDay() - 1
    if (firstDay === -1) firstDay = 6
    const totalDays = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d))
    return cells
  }, [viewDate])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const handleClick = (date: Date) => {
    const iso = toISODate(date)
    if (!start || (start && end)) onChange(iso, null)
    else if (iso < start) onChange(iso, start)
    else onChange(start, iso)
  }

  const inRange = (iso: string) => {
    if (!start) return false
    const rangeEnd = end || hoverISO
    if (!rangeEnd) return false
    const lo = start < rangeEnd ? start : rangeEnd
    const hi = start < rangeEnd ? rangeEnd : start
    return iso > lo && iso < hi
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="size-9 flex items-center justify-center rounded-lg hover:bg-white text-slate-500">
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-black text-[#323232] capitalize">{MESES_CALENDARIO[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
        <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="size-9 flex items-center justify-center rounded-lg hover:bg-white text-slate-500">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_CALENDARIO.map(d => <span key={d} className="text-[11px] font-black text-slate-400 text-center uppercase">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          if (!date) return <div key={`e${i}`} />
          const iso = toISODate(date)
          const isStart = iso === start
          const isEnd = iso === end
          const isBetween = inRange(iso)
          const isFuture = date > today
          return (
            <button
              key={iso}
              type="button"
              disabled={isFuture}
              onMouseEnter={() => setHoverISO(iso)}
              onClick={() => handleClick(date)}
              className={cn(
                "h-9 rounded-lg text-[13px] font-bold transition-colors",
                isFuture && "text-slate-300 cursor-not-allowed",
                !isFuture && (isStart || isEnd) && "text-white",
                !isFuture && !isStart && !isEnd && isBetween && "bg-[#2D6A4F]/10 text-[#2D6A4F]",
                !isFuture && !isStart && !isEnd && !isBetween && "text-slate-600 hover:bg-white"
              )}
              style={!isFuture && (isStart || isEnd) ? { backgroundColor: VERDE } : undefined}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PersonaCard({ persona, tipo, isProcessing, onEntry, patentes }: {
  persona: any
  tipo: TipoPersona
  isProcessing: string | null
  onEntry: (persona: any, tipo: TipoPersona) => void
  patentes: any[]
}) {
  const esVisita = tipo === 'visita_frecuente'
  const col = tipo === 'residente' ? 'residente_id' : 'visita_frecuente_id'
  const propias = patentes.filter(p => p[col] === persona.id).map(p => p.patente as string)
  const unidad = tipo === 'residente' ? persona.unidad : persona.unidad_destino

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 p-4 rounded-2xl border hover:bg-white hover:shadow-md transition-all group",
      esVisita ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
    )}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn(
          "size-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
          esVisita ? "bg-amber-100 group-hover:bg-amber-500" : "bg-[#2D6A4F]/10 group-hover:bg-[#2D6A4F]"
        )}>
          <User className={cn("size-6 transition-colors group-hover:text-white", esVisita ? "text-amber-600" : "text-[#2D6A4F]")} />
        </div>
        <div className="min-w-0">
          <p className="font-black text-[#323232] text-base">{persona.nombre} {persona.apellido}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {unidad && (
              <span className={cn("text-[12px] font-bold uppercase", esVisita ? "text-amber-600" : "text-[#2D6A4F]")}>
                {tipo === 'residente' ? `Unidad ${unidad}` : `→ Unidad ${unidad}`}
              </span>
            )}
            {esVisita && persona.tipo_servicio && (
              <><span className="text-slate-200">·</span>
              <span className="text-[12px] font-bold text-slate-400 uppercase">{persona.tipo_servicio}</span></>
            )}
            {tipo === 'residente' && persona.tipo && (
              <><span className="text-slate-200">·</span>
              <span className="text-[12px] font-bold text-slate-400 uppercase">{persona.tipo}</span></>
            )}
            {propias.length > 0 && (
              <><span className="text-slate-200">·</span>
              <span className="text-[12px] font-bold uppercase text-emerald-600">{propias.join(' / ')}</span></>
            )}
          </div>
        </div>
      </div>
      <Button
        className={cn("text-white rounded-xl font-black px-4 h-11 shadow-lg gap-2 shrink-0",
          esVisita ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" : "shadow-[#2D6A4F]/20"
        )}
        style={esVisita ? undefined : { backgroundColor: VERDE }}
        onClick={() => onEntry(persona, tipo)}
        disabled={!!isProcessing}
      >
        {isProcessing === `entry-${persona.id}` ? <Loader2 className="animate-spin size-5" /> : <><LogIn className="size-5" /><span className="hidden sm:inline">Ingresar</span></>}
      </Button>
    </div>
  )
}

export default function PorteriaPage() {
  const router = useRouter()
  const [sesion, setSesion] = useState<{ id: string; nombre: string; rol: string } | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [residentes, setResidentes] = useState<any[]>([])
  const [visitasFrecuentes, setVisitasFrecuentes] = useState<any[]>([])
  const [patentes, setPatentes] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeSearchTerm, setActiveSearchTerm] = useState("")
  const [exitsSearchTerm, setExitsSearchTerm] = useState("")

  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<any>(null)
  const [entryTipo, setEntryTipo] = useState<TipoPersona>('residente')
  const [selectedPatente, setSelectedPatente] = useState("")
  const [entryObservacion, setEntryObservacion] = useState("")

  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [selectedLogForExit, setSelectedLogForExit] = useState<any>(null)
  const [exitPatente, setExitPatente] = useState("")
  const [exitObservacion, setExitObservacion] = useState("")

  const [showVisitaForm, setShowVisitaForm] = useState(false)
  const [visitaData, setVisitaData] = useState({
    nombre: '', rut: '', unidad_destino: '', motivo: '', patente: '', observacion: '', tieneVehiculo: false
  })
  const [visitaSuggestions, setVisitaSuggestions] = useState<any[]>([])
  const visitaSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isEditLogDialogOpen, setIsEditLogDialogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<any>(null)
  const [editLogForm, setEditLogForm] = useState({
    nombre_manual: '', unidad_destino: '', motivo: '', patente: '', observacion: '', hora_ingreso: '', hora_salida: ''
  })
  const [isSavingEditLog, setIsSavingEditLog] = useState(false)

  const [selectedViewDate, setSelectedViewDate] = useState<string>(() => getChileDateStr(new Date()))
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedReportPeriod, setSelectedReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedExportWeekIndex, setSelectedExportWeekIndex] = useState(0)
  const [customRangeStart, setCustomRangeStart] = useState<string | null>(null)
  const [customRangeEnd, setCustomRangeEnd] = useState<string | null>(null)

  const SELECT_LOGS = '*, residente:residentes(nombre, apellido, rut, unidad), registrado_por:usuarios!registrado_por_id(nombre), salida_por:usuarios!salida_por_id(nombre)'

  const monthOptions = React.useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    const curYear = now.getFullYear()
    for (let y = curYear; y >= curYear - 2; y--) {
      const from = y === curYear ? now.getMonth() + 1 : 12
      for (let m = from; m >= 1; m--) {
        opts.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MESES_CALENDARIO[m - 1]} ${y}` })
      }
    }
    return opts
  }, [])

  const weekOptions = React.useMemo(() => getCalendarWeeks(), [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => setSesion(u))
      .catch(() => {})
    fetchData()
  }, [])

  useEffect(() => {
    const today = getChileDateStr(new Date())
    if (selectedViewDate && selectedViewDate !== today) fetchHistoryLogs(selectedViewDate)
    else setHistoryLogs([])
  }, [selectedViewDate])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const ayer = new Date()
      ayer.setDate(ayer.getDate() - 1)
      const ayerStr = getChileDateStr(ayer)

      const [residentesRes, visitasRes, logsRes, patentesRes] = await Promise.all([
        proxy({ table: 'residentes', method: 'select', filters: [{ column: 'activo', operator: 'eq', value: true }] }),
        proxy({ table: 'visitas_frecuentes', method: 'select', filters: [{ column: 'activo', operator: 'eq', value: true }] }),
        proxy({
          table: 'logs_porteria', method: 'select', data: SELECT_LOGS,
          filters: [{ column: 'fecha', operator: 'gte', value: ayerStr }],
          order: 'hora_ingreso:desc', limit: 2000
        }),
        proxy({ table: 'porteria_patentes', method: 'select', filters: [{ column: 'activo', operator: 'eq', value: true }] }),
      ])

      setResidentes(residentesRes.data || [])
      setVisitasFrecuentes(visitasRes.data || [])
      setLogs(logsRes.data || [])
      setPatentes(patentesRes.data || [])
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar los datos.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHistoryLogs = async (date: string) => {
    setIsHistoryLoading(true)
    try {
      const { data } = await proxy({
        table: 'logs_porteria', method: 'select', data: SELECT_LOGS,
        filters: [{ column: 'fecha', operator: 'eq', value: date }],
        order: 'hora_ingreso:asc', limit: 500
      })
      setHistoryLogs(data || [])
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar el historial.")
      setHistoryLogs([])
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // ── Patentes ────────────────────────────────────────────────────
  const getPatentesConocidas = (personaId: string | undefined, tipo: TipoPersona) => {
    if (!personaId) return []
    const col = tipo === 'residente' ? 'residente_id' : 'visita_frecuente_id'
    return patentes.filter(p => p[col] === personaId).map(p => p.patente as string)
  }

  const getPatenteOptions = (persona: any, tipo: TipoPersona): string[] => {
    const set = new Set<string>()
    if (persona?.patente_default) set.add(String(persona.patente_default).toUpperCase())
    for (const p of getPatentesConocidas(persona?.id, tipo)) set.add(String(p).toUpperCase())
    return [...set]
  }

  // Append-only: una patente nueva se suma al historial de la persona, nunca pisa
  // las ya conocidas. La primera vista queda además como `patente_default`.
  const memorizarPatente = async (persona: any, patente: string, tipo: TipoPersona) => {
    if (!patente) return
    const col = tipo === 'residente' ? 'residente_id' : 'visita_frecuente_id'
    try {
      if (!getPatentesConocidas(persona.id, tipo).includes(patente)) {
        const { data } = await proxy({
          table: 'porteria_patentes', method: 'insert', data: { [col]: persona.id, patente }
        })
        if (data?.[0]) setPatentes(prev => [...prev, data[0]])
      }
    } catch {
      // La memorización es un efecto secundario del registro: si falla, el ingreso
      // ya quedó guardado y no vale interrumpir al conserje con un error.
    }
  }

  // ── Ingreso ─────────────────────────────────────────────────────
  // Sin ambigüedad de patente (0 o 1 opción) el ingreso se registra directo.
  // Con 2+ se abre el modal para que el conserje elija.
  const handleRegisterEntry = (persona: any, tipo: TipoPersona) => {
    const opciones = getPatenteOptions(persona, tipo)
    if (opciones.length <= 1) {
      doRegisterEntry(persona, opciones[0] || "", tipo, "")
      return
    }
    setSelectedPersona(persona)
    setEntryTipo(tipo)
    setSelectedPatente(persona.patente_default || "")
    setEntryObservacion("")
    setIsEntryDialogOpen(true)
  }

  const doRegisterEntry = async (persona: any, patente: string, tipo: TipoPersona, observacion: string) => {
    setIsProcessing(`entry-${persona.id}`)
    try {
      const base = {
        patente: patente || null,
        hora_ingreso: new Date().toISOString(),
        observacion: observacion || null,
      }
      const logData = tipo === 'residente'
        ? { ...base, residente_id: persona.id, unidad_destino: persona.unidad }
        : {
            ...base,
            visita_frecuente_id: persona.id,
            nombre_manual: `${persona.nombre} ${persona.apellido}`,
            unidad_destino: persona.unidad_destino || null,
            motivo: persona.tipo_servicio || null,
          }

      await proxy({ table: 'logs_porteria', method: 'insert', data: logData })
      await fetchData()
      setIsEntryDialogOpen(false)
      setSearchTerm("")
      toast.success(`Ingreso registrado: ${persona.nombre} ${persona.apellido}`)
      memorizarPatente(persona, patente, tipo)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar el ingreso.")
    } finally {
      setIsProcessing(null)
    }
  }

  const confirmEntry = () => {
    if (!selectedPersona) return
    return doRegisterEntry(selectedPersona, selectedPatente, entryTipo, entryObservacion)
  }

  // ── Salida ──────────────────────────────────────────────────────
  const personaDeLog = (log: any) => {
    if (log.residente_id) return { persona: residentes.find(p => p.id === log.residente_id), tipo: 'residente' as TipoPersona }
    if (log.visita_frecuente_id) return { persona: visitasFrecuentes.find(p => p.id === log.visita_frecuente_id), tipo: 'visita_frecuente' as TipoPersona }
    return { persona: null, tipo: 'residente' as TipoPersona }
  }

  const handleRegisterExit = (log: any) => {
    const { persona, tipo } = personaDeLog(log)
    const opciones = persona ? getPatenteOptions(persona, tipo) : []
    if (opciones.length <= 1) {
      doRegisterExit(log, log.patente || "", log.observacion || "")
      return
    }
    setSelectedLogForExit(log)
    setExitPatente(log.patente || "")
    setExitObservacion(log.observacion || "")
    setIsExitDialogOpen(true)
  }

  const doRegisterExit = async (log: any, patente: string, observacion: string) => {
    setIsProcessing(`exit-${log.id}`)
    try {
      await proxy({
        table: 'logs_porteria', method: 'update', match: { id: log.id },
        data: { patente: patente || null, hora_salida: new Date().toISOString(), observacion: observacion || null }
      })
      await fetchData()
      setIsExitDialogOpen(false)
      toast.success('Salida registrada')
      const { persona, tipo } = personaDeLog(log)
      if (persona) memorizarPatente(persona, patente, tipo)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la salida.")
    } finally {
      setIsProcessing(null)
    }
  }

  const confirmExit = () => {
    if (!selectedLogForExit) return
    return doRegisterExit(selectedLogForExit, exitPatente, exitObservacion)
  }

  // ── Visita puntual (formulario manual) ──────────────────────────
  const handleVisitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (visitaData.tieneVehiculo && !visitaData.patente) {
      toast.error('Ingresa la patente: marcaste que la visita viene en vehículo')
      return
    }
    setIsProcessing('visita')
    try {
      await proxy({
        table: 'logs_porteria', method: 'insert',
        data: {
          nombre_manual: visitaData.nombre,
          rut_manual: visitaData.rut || null,
          unidad_destino: visitaData.unidad_destino,
          motivo: visitaData.motivo || null,
          patente: visitaData.patente || null,
          observacion: visitaData.observacion || null,
          hora_ingreso: new Date().toISOString(),
        }
      })
      setVisitaData({ nombre: '', rut: '', unidad_destino: '', motivo: '', patente: '', observacion: '', tieneVehiculo: false })
      setVisitaSuggestions([])
      setShowVisitaForm(false)
      await fetchData()
      toast.success('Visita registrada')
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la visita.")
    } finally {
      setIsProcessing(null)
    }
  }

  // Sugerencias por nombre mientras se escribe — cubre al visitante recurrente
  // que el conserje reconoce de nombre pero cuyo RUT no recuerda.
  const searchVisitaHistory = async (term: string) => {
    if (term.trim().length < 3) { setVisitaSuggestions([]); return }
    try {
      const { data } = await proxy({
        table: 'logs_porteria', method: 'select',
        data: 'nombre_manual, rut_manual, unidad_destino, motivo, patente',
        filters: [{ column: 'nombre_manual', operator: 'ilike', value: `%${term.trim()}%` }],
        order: 'hora_ingreso:desc', limit: 30
      })
      const seen = new Set<string>()
      const unique: any[] = []
      for (const r of (data || [])) {
        const key = (r.rut_manual || r.nombre_manual || '').toUpperCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        unique.push(r)
        if (unique.length >= 5) break
      }
      setVisitaSuggestions(unique)
    } catch {
      setVisitaSuggestions([])
    }
  }

  const handleVisitaNombreChange = (value: string) => {
    setVisitaData(d => ({ ...d, nombre: value }))
    if (visitaSearchTimeout.current) clearTimeout(visitaSearchTimeout.current)
    visitaSearchTimeout.current = setTimeout(() => searchVisitaHistory(value), 300)
  }

  const pickVisitaSuggestion = (s: any) => {
    setVisitaData(d => ({
      ...d,
      nombre: s.nombre_manual || d.nombre,
      rut: s.rut_manual || d.rut,
      unidad_destino: s.unidad_destino || d.unidad_destino,
      motivo: s.motivo || d.motivo,
      patente: s.patente || d.patente,
      tieneVehiculo: !!s.patente || d.tieneVehiculo
    }))
    setVisitaSuggestions([])
  }

  // Autocompleta con la última visita registrada para ese RUT (memoria de
  // habituales sin necesitar tabla nueva — lee del historial existente).
  const lookupVisitaByRut = async (rutRaw: string) => {
    const rut = rutRaw.trim().toUpperCase()
    if (rut.length < 5) return
    try {
      const { data } = await proxy({
        table: 'logs_porteria', method: 'select',
        data: 'nombre_manual, unidad_destino, motivo, patente',
        filters: [{ column: 'rut_manual', operator: 'eq', value: rut }],
        order: 'hora_ingreso:desc', limit: 1
      })
      const prev = (data || [])[0]
      if (!prev) return
      setVisitaData(d => ({
        ...d,
        nombre: d.nombre || prev.nombre_manual || '',
        unidad_destino: d.unidad_destino || prev.unidad_destino || '',
        motivo: d.motivo || prev.motivo || '',
        patente: d.patente || prev.patente || '',
        tieneVehiculo: d.tieneVehiculo || !!prev.patente
      }))
      toast.success('Datos recuperados de una visita anterior')
    } catch {
      // Silencioso: es una ayuda opcional, no debe interrumpir la carga manual.
    }
  }

  // ── Editar / eliminar registro ──────────────────────────────────
  const handleOpenEditLog = (log: any) => {
    setEditingLog(log)
    setEditLogForm({
      nombre_manual: log.nombre_manual || '',
      unidad_destino: log.unidad_destino || '',
      motivo: log.motivo || '',
      patente: log.patente || '',
      observacion: log.observacion || '',
      hora_ingreso: isoToChileLocalInput(log.hora_ingreso),
      hora_salida: isoToChileLocalInput(log.hora_salida)
    })
    setIsEditLogDialogOpen(true)
  }

  const refreshAfterLogChange = async () => {
    await fetchData()
    if (selectedViewDate !== todayStr) fetchHistoryLogs(selectedViewDate)
  }

  const handleSaveEditLog = async () => {
    if (!editingLog) return
    if (!editLogForm.hora_ingreso) { toast.error("La hora de ingreso es obligatoria"); return }

    const isoIngreso = chileLocalInputToISO(editLogForm.hora_ingreso)
    const isoSalida = chileLocalInputToISO(editLogForm.hora_salida)
    const now = Date.now()

    if (!isoIngreso || new Date(isoIngreso).getTime() > now) {
      toast.error("La hora de ingreso no puede ser en el futuro"); return
    }
    if (isoSalida) {
      if (new Date(isoSalida).getTime() > now) {
        toast.error("La hora de salida no puede ser en el futuro"); return
      }
      if (new Date(isoSalida).getTime() <= new Date(isoIngreso).getTime()) {
        toast.error("La hora de salida debe ser posterior a la hora de ingreso"); return
      }
    }

    setIsSavingEditLog(true)
    try {
      const data: any = {
        unidad_destino: editLogForm.unidad_destino || null,
        motivo: editLogForm.motivo || null,
        patente: editLogForm.patente || null,
        observacion: editLogForm.observacion || null,
        hora_ingreso: isoIngreso,
        hora_salida: isoSalida,
      }
      if (!editingLog.residente_id) data.nombre_manual = editLogForm.nombre_manual || null

      await proxy({ table: 'logs_porteria', method: 'update', match: { id: editingLog.id }, data })
      toast.success('Registro corregido')
      setIsEditLogDialogOpen(false)
      setEditingLog(null)
      refreshAfterLogChange()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo corregir el registro.")
    } finally {
      setIsSavingEditLog(false)
    }
  }

  const handleDeleteLog = async (log: any) => {
    const nombre = log.residente ? `${log.residente.nombre} ${log.residente.apellido}` : (log.nombre_manual || 'este registro')
    if (!confirm(`¿Eliminar el ingreso de ${nombre}? Esta acción no se puede deshacer.`)) return
    setIsProcessing(`delete-${log.id}`)
    try {
      await proxy({ table: 'logs_porteria', method: 'delete', match: { id: log.id } })
      toast.success('Registro eliminado')
      refreshAfterLogChange()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el registro.")
    } finally {
      setIsProcessing(null)
    }
  }

  // ── Reporte Excel ───────────────────────────────────────────────
  const handleGenerateReport = async (personType: 'residentes' | 'visitas' | 'todos', range: 'daily' | 'weekly' | 'monthly' | 'custom') => {
    if (range === 'custom' && (!customRangeStart || !customRangeEnd)) {
      toast.error("Selecciona un rango de fechas completo antes de generar el reporte")
      return
    }
    setIsGenerating(true)
    try {
      const now = new Date()
      let rawData: any[] = []

      const traerBloque = async (startStr: string, endStr: string) => {
        const { data } = await proxy({
          table: 'logs_porteria', method: 'select', data: SELECT_LOGS,
          filters: [
            { column: 'hora_ingreso', operator: 'gte', value: chileDayBoundsISO(startStr).startISO },
            { column: 'hora_ingreso', operator: 'lte', value: chileDayBoundsISO(endStr).endISO },
          ],
          order: 'hora_ingreso:desc'
        })
        return data || []
      }

      if (range === 'daily') {
        rawData = await traerBloque(getChileDateStr(now), getChileDateStr(now))
      } else if (range === 'weekly') {
        const w = weekOptions[selectedExportWeekIndex]
        rawData = await traerBloque(toISODate(w.start), toISODate(w.end))
      } else {
        let startStr: string
        let endStr: string
        if (range === 'monthly') {
          const [yearStr, monthStr] = selectedExportMonth.split('-')
          const esMesActual = selectedExportMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const lastDay = esMesActual ? now.getDate() : new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate()
          startStr = `${yearStr}-${monthStr}-01`
          endStr = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
        } else {
          startStr = customRangeStart!
          endStr = customRangeEnd!
        }
        const bloques = buildDateBlocks(startStr, endStr)
        const resultados = await Promise.all(bloques.map(b => traerBloque(b.start, b.end)))
        resultados.forEach(d => { rawData = rawData.concat(d) })
        rawData.sort((a, b) => new Date(b.hora_ingreso).getTime() - new Date(a.hora_ingreso).getTime())
      }

      if (personType === 'residentes') rawData = rawData.filter(l => l.residente_id !== null)
      else if (personType === 'visitas') rawData = rawData.filter(l => l.residente_id === null)

      if (rawData.length === 0) { toast.error("No se encontraron registros para el periodo seleccionado"); return }

      const filas = rawData.map(l => ({
        "Tipo": l.residente_id ? 'RESIDENTE' : (l.visita_frecuente_id ? 'VISITA FRECUENTE' : 'VISITA'),
        "Nombre": l.residente_id
          ? `${l.residente?.nombre || ''} ${l.residente?.apellido || ''}`.trim()
          : (l.nombre_manual || "-"),
        "RUT": l.residente_id ? (l.residente?.rut || "-") : (l.rut_manual || "-"),
        "Unidad": l.unidad_destino || l.residente?.unidad || "-",
        "Motivo": l.motivo || "-",
        "Observación": l.observacion || "-",
        "Patente": l.patente || "S/P",
        "Fecha Ingreso": formatFecha(l.hora_ingreso),
        "Hora Ingreso": formatHoraChile(l.hora_ingreso),
        "Fecha Salida": l.hora_salida ? formatFecha(l.hora_salida) : "PENDIENTE",
        "Hora Salida": l.hora_salida ? formatHoraChile(l.hora_salida) : "PENDIENTE",
        "Registró Ingreso": l.registrado_por?.nombre || "-",
        "Registró Salida": l.salida_por?.nombre || (l.hora_salida ? "S/D" : "-"),
      }))

      const columnas = [
        { header: 'Tipo', key: 'Tipo', width: 18 },
        { header: 'Nombre', key: 'Nombre', width: 30 },
        { header: 'RUT', key: 'RUT', width: 14 },
        { header: 'Unidad', key: 'Unidad', width: 12 },
        { header: 'Motivo', key: 'Motivo', width: 22 },
        { header: 'Observación', key: 'Observación', width: 30 },
        { header: 'Patente', key: 'Patente', width: 12 },
        { header: 'Fecha Ingreso', key: 'Fecha Ingreso', width: 14 },
        { header: 'Hora Ingreso', key: 'Hora Ingreso', width: 14 },
        { header: 'Fecha Salida', key: 'Fecha Salida', width: 14 },
        { header: 'Hora Salida', key: 'Hora Salida', width: 14 },
        { header: 'Registró Ingreso', key: 'Registró Ingreso', width: 24 },
        { header: 'Registró Salida', key: 'Registró Salida', width: 24 },
      ]

      const pad = (n: number) => String(n).padStart(2, '0')
      const fmtCorto = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}`
      const semana = weekOptions[selectedExportWeekIndex]
      const [yearStr, monthStr] = selectedExportMonth.split('-')
      const periodo = range === 'daily'
        ? 'DIARIO'
        : range === 'weekly'
          ? `SEMANAL_${fmtCorto(semana.start)}_al_${fmtCorto(semana.end)}`
          : range === 'custom'
            ? `RANGO_${fmtCorto(new Date(customRangeStart! + 'T00:00:00'))}_al_${fmtCorto(new Date(customRangeEnd! + 'T00:00:00'))}`
            : `MES_${MESES_CALENDARIO[parseInt(monthStr) - 1].toUpperCase()}_${yearStr}`

      const tipoLabel = personType === 'residentes' ? 'Residentes' : personType === 'visitas' ? 'Visitas' : 'Todos'

      await exportExcel(`Portería ${tipoLabel} ${periodo}`, [{
        name: 'Reporte',
        columns: columnas,
        rows: filas,
        totalsRow: Object.fromEntries(columnas.map((c, i) => [c.key, i === 0 ? 'TOTAL' : i === 1 ? `${filas.length} registros` : '']))
      }])

      toast.success('Reporte generado con éxito')
      setIsReportModalOpen(false)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar el reporte.")
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Datos derivados ─────────────────────────────────────────────
  const todayStr = getChileDateStr(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getChileDateStr(yesterday)

  const esHoyOAyer = (l: any) =>
    l.fecha === todayStr || getChileDateStr(l.hora_ingreso) === todayStr ||
    l.fecha === yesterdayStr || getChileDateStr(l.hora_ingreso) === yesterdayStr

  const todayLogs = logs.filter(l => l.fecha === todayStr || getChileDateStr(l.hora_ingreso) === todayStr)
  const ingresosHoy = todayLogs.length
  // Salidas registradas HOY (no ingresos-de-hoy-con-salida): así cuadra con la
  // lista y cuenta bien a quien entró ayer de noche y salió hoy.
  const salidasHoy = logs.filter(l => l.hora_salida && getChileDateStr(l.hora_salida) === todayStr).length
  const visitasHoy = todayLogs.filter(l => !l.residente_id).length

  const adentroResidenteIds = new Set(
    logs.filter(l => !l.hora_salida && esHoyOAyer(l)).map(l => l.residente_id).filter(Boolean)
  )
  const adentroVisitaIds = new Set(
    logs.filter(l => !l.hora_salida && esHoyOAyer(l)).map(l => l.visita_frecuente_id).filter(Boolean)
  )

  const term = searchTerm.toLowerCase()
  const filteredResidentes = searchTerm.length === 0 ? [] : residentes.filter(p =>
    !adentroResidenteIds.has(p.id) && (
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.unidad?.toLowerCase().includes(term)
    )
  ).slice(0, 6)

  const filteredVisitas = searchTerm.length === 0 ? [] : visitasFrecuentes.filter(p =>
    !adentroVisitaIds.has(p.id) && (
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.tipo_servicio?.toLowerCase().includes(term) ||
      p.unidad_destino?.toLowerCase().includes(term)
    )
  ).slice(0, 4)

  // Últimas 10 personas únicas que pasaron hoy (excluye a las que están adentro ahora)
  const recientes = React.useMemo(() => {
    const sorted = [...logs]
      .filter(l => l.fecha === todayStr || getChileDateStr(l.hora_ingreso) === todayStr)
      .sort((a, b) => new Date(b.hora_ingreso).getTime() - new Date(a.hora_ingreso).getTime())
    const seen = new Set<string>()
    const result: Array<{ persona: any; tipo: TipoPersona }> = []
    for (const log of sorted) {
      if (result.length >= 10) break
      if (log.residente_id && !adentroResidenteIds.has(log.residente_id) && !seen.has(log.residente_id)) {
        seen.add(log.residente_id)
        const persona = residentes.find(p => p.id === log.residente_id)
        if (persona) result.push({ persona, tipo: 'residente' })
      } else if (log.visita_frecuente_id && !adentroVisitaIds.has(log.visita_frecuente_id) && !seen.has(log.visita_frecuente_id)) {
        seen.add(log.visita_frecuente_id)
        const persona = visitasFrecuentes.find(p => p.id === log.visita_frecuente_id)
        if (persona) result.push({ persona, tipo: 'visita_frecuente' })
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, residentes, visitasFrecuentes, todayStr])

  const nombreDeLog = (l: any) => l.residente ? `${l.residente.nombre} ${l.residente.apellido}` : (l.nombre_manual || "")

  const coincideBusqueda = (l: any, t: string) => {
    if (!t) return true
    const q = t.toLowerCase()
    return nombreDeLog(l).toLowerCase().includes(q) ||
      l.unidad_destino?.toLowerCase().includes(q) ||
      l.patente?.toLowerCase().includes(q)
  }

  // Solo hoy/ayer (cubre turno de noche) para no arrastrar pendientes antiguos.
  const activeEntries = logs.filter(l => !l.hora_salida && esHoyOAyer(l) && coincideBusqueda(l, activeSearchTerm))

  const recentExits = logs.filter(l =>
    l.hora_salida && getChileDateStr(l.hora_salida) === todayStr && coincideBusqueda(l, exitsSearchTerm)
  )

  const exitPersonaRecord = selectedLogForExit ? personaDeLog(selectedLogForExit) : null

  // ── JSX ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] p-3 sm:p-4 md:p-10 space-y-5 sm:space-y-8">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <img src="/logo-condominio.png" alt="Condominio Villa Tepual" className="h-10 sm:h-12 w-auto object-contain group-hover:opacity-70 transition-opacity" />
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Control de Portería</p>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" className="h-11 rounded-xl font-black border-slate-200" onClick={fetchData}>
            <RefreshCw className={cn("size-5", isLoading && "animate-spin")} />
          </Button>

          <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 text-white rounded-xl font-bold gap-2 shadow-lg" style={{ backgroundColor: VERDE }}>
                <FileSpreadsheet className="size-5" />
                <span className="hidden sm:inline">Reportes Excel</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto sm:max-w-md max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="space-y-3">
                <div className="size-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}>
                  <Download className="size-7" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Exportar Registros</DialogTitle>
                  <DialogDescription className="text-slate-500 font-medium text-base">Elige el período y descarga el tipo que necesitas.</DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: 'daily', label: 'Diario', sub: 'Hoy' },
                  { value: 'weekly', label: 'Semanal', sub: 'Esta semana' },
                  { value: 'monthly', label: 'Mensual', sub: 'Por mes' },
                  { value: 'custom', label: 'Rango', sub: 'Personalizado' },
                ] as const).map(({ value, label, sub }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedReportPeriod(value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-3 px-2 rounded-2xl border-2 transition-all",
                      selectedReportPeriod === value ? "text-white" : "border-slate-100 bg-slate-50 text-slate-400"
                    )}
                    style={selectedReportPeriod === value ? { backgroundColor: VERDE, borderColor: VERDE } : undefined}
                  >
                    <span className="text-sm font-black uppercase tracking-wide">{label}</span>
                    <span className="text-[12px] font-medium">{sub}</span>
                  </button>
                ))}
              </div>

              {selectedReportPeriod === 'weekly' && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <Label htmlFor="week-select" className="text-[12px] font-black uppercase tracking-widest ml-1" style={{ color: VERDE }}>Semana</Label>
                  <select
                    id="week-select"
                    value={selectedExportWeekIndex}
                    onChange={(e) => setSelectedExportWeekIndex(parseInt(e.target.value))}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-base md:text-sm font-bold text-[#323232] outline-none cursor-pointer"
                  >
                    {weekOptions.map((w, idx) => <option key={idx} value={idx}>{w.label}</option>)}
                  </select>
                </div>
              )}

              {selectedReportPeriod === 'monthly' && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <Label htmlFor="month-select" className="text-[12px] font-black uppercase tracking-widest ml-1" style={{ color: VERDE }}>Mes</Label>
                  <select
                    id="month-select"
                    value={selectedExportMonth}
                    onChange={(e) => setSelectedExportMonth(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-base md:text-sm font-bold text-[#323232] outline-none cursor-pointer"
                  >
                    {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {selectedReportPeriod === 'custom' && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <Label className="text-[12px] font-black uppercase tracking-widest ml-1" style={{ color: VERDE }}>
                    {customRangeStart && customRangeEnd
                      ? `Rango: ${isoToDDMM(customRangeStart)} al ${isoToDDMM(customRangeEnd)}`
                      : customRangeStart ? "Elige la fecha final" : "Elige la fecha de inicio"}
                  </Label>
                  <DateRangeCalendar
                    start={customRangeStart}
                    end={customRangeEnd}
                    onChange={(s, e) => { setCustomRangeStart(s); setCustomRangeEnd(e) }}
                  />
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2">
                {([
                  { type: 'residentes', label: 'Residentes', icon: Users2 },
                  { type: 'visitas', label: 'Visitas', icon: UserSquare2 },
                  { type: 'todos', label: 'Todos', icon: Users },
                ] as const).map(({ type, label, icon: Icon }) => {
                  const rangoIncompleto = selectedReportPeriod === 'custom' && (!customRangeStart || !customRangeEnd)
                  return (
                    <button
                      key={type}
                      onClick={() => handleGenerateReport(type, selectedReportPeriod)}
                      disabled={isGenerating || rangoIncompleto}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-500 font-black text-sm uppercase tracking-wide transition-all",
                        (isGenerating || rangoIncompleto) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Icon className="size-6" style={{ color: VERDE }} />
                      {label}
                    </button>
                  )
                })}
              </div>

              {selectedReportPeriod === 'custom' && (!customRangeStart || !customRangeEnd) && (
                <p className="mt-2 text-[12px] font-bold text-amber-600 uppercase tracking-widest text-center">Selecciona inicio y fin del rango para habilitar la descarga</p>
              )}
              <p className="mt-4 text-[12px] font-bold text-slate-400 uppercase tracking-widest text-center">Los reportes se descargan en formato .xlsx</p>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="h-11 rounded-xl font-bold border-slate-200 text-slate-500 gap-2" onClick={handleLogout}>
            <Power className="size-5" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Personas Adentro", value: activeEntries.length, icon: <Users className="size-5" style={{ color: VERDE }} />, color: "bg-emerald-50 border-emerald-100", vcolor: "text-emerald-800" },
          { label: "Ingresos Hoy", value: ingresosHoy, icon: <LogIn className="size-5 text-sky-600" />, color: "bg-sky-50 border-sky-100", vcolor: "text-sky-700" },
          { label: "Salidas Hoy", value: salidasHoy, icon: <LogOut className="size-5 text-orange-600" />, color: "bg-orange-50 border-orange-100", vcolor: "text-orange-700" },
          { label: "Visitas Hoy", value: visitasHoy, icon: <UserPlus className="size-5 text-amber-600" />, color: "bg-amber-50 border-amber-100", vcolor: "text-amber-700" },
        ].map((k, i) => (
          <Card key={i} className={cn("border rounded-2xl shadow-none", k.color)}>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 leading-tight">{k.label}</p>
                <p className={cn("text-3xl font-black mt-1", k.vcolor)}>{k.value}</p>
              </div>
              <div className="size-10 sm:size-11 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">{k.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GRID PRINCIPAL — el split 7/5 entra recién en 2xl: entre 1024 y 1535 la
          columna derecha queda muy angosta y los nombres se parten. */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 2xl:gap-8 items-start">

        {/* COLUMNA IZQUIERDA — registrar ingreso */}
        <div className="2xl:col-span-7 space-y-6">
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-5 sm:p-10 space-y-6">
              {sesion && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ backgroundColor: `${VERDE}14`, border: `1px solid ${VERDE}26` }}>
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: VERDE }}>
                    <Shield className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: `${VERDE}99` }}>
                      En turno — tus registros quedan firmados
                    </p>
                    <p className="text-base font-black uppercase tracking-tight" style={{ color: VERDE }}>{sesion.nombre}</p>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#323232] uppercase tracking-tight">Registrar Ingreso</h2>
                <p className="text-sm sm:text-base text-slate-400 font-medium mt-0.5">Busca un residente o registra una visita.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <Input
                  placeholder="Nombre, RUT o unidad…"
                  className="h-12 sm:h-14 pl-11 pr-4 bg-slate-50 border-none rounded-2xl text-base sm:text-lg font-bold placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  onKeyDown={(e) => {
                    // Enter con un único resultado → registra ese ingreso directo.
                    if (e.key !== 'Enter' || isProcessing) return
                    const total = filteredResidentes.length + filteredVisitas.length
                    if (total !== 1) return
                    e.preventDefault()
                    if (filteredResidentes.length === 1) handleRegisterEntry(filteredResidentes[0], 'residente')
                    else handleRegisterEntry(filteredVisitas[0], 'visita_frecuente')
                  }}
                />
              </div>

              {(searchFocused || searchTerm.length > 0) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {searchTerm.length === 0 ? (
                    recientes.length === 0 ? (
                      <div className="py-6 text-center">
                        <Clock className="size-9 text-slate-200 mx-auto mb-2" />
                        <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Sin registros hoy — escribe para buscar</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Registrados hoy — toca para volver a ingresar</p>
                        {recientes.map(({ persona, tipo }) => (
                          <PersonaCard key={persona.id} persona={persona} tipo={tipo} isProcessing={isProcessing} onEntry={handleRegisterEntry} patentes={patentes} />
                        ))}
                      </div>
                    )
                  ) : (
                    filteredResidentes.length === 0 && filteredVisitas.length === 0 ? (
                      <div className="py-8 text-center space-y-3">
                        <User className="size-11 text-slate-200 mx-auto" />
                        <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Sin resultados</p>
                        <Button
                          variant="outline"
                          className="rounded-xl font-black border-slate-200 gap-2 mx-auto"
                          style={{ color: VERDE }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setVisitaData(d => ({ ...d, nombre: searchTerm }))
                            setShowVisitaForm(true)
                            setSearchTerm("")
                          }}
                        >
                          <UserPlus className="size-4" /> Registrar como visita
                        </Button>
                      </div>
                    ) : (
                      <>
                        {filteredResidentes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-widest ml-1" style={{ color: VERDE }}>Residentes</p>
                            {filteredResidentes.map(persona => (
                              <PersonaCard key={persona.id} persona={persona} tipo="residente" isProcessing={isProcessing} onEntry={handleRegisterEntry} patentes={patentes} />
                            ))}
                          </div>
                        )}
                        {filteredVisitas.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 ml-1">Visitas Frecuentes</p>
                            {filteredVisitas.map(persona => (
                              <PersonaCard key={persona.id} persona={persona} tipo="visita_frecuente" isProcessing={isProcessing} onEntry={handleRegisterEntry} patentes={patentes} />
                            ))}
                          </div>
                        )}
                      </>
                    )
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-bold text-slate-400 italic">¿Visita, delivery o proveedor?</p>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl font-black border-slate-200 gap-2"
                  style={{ color: VERDE }}
                  onClick={() => setShowVisitaForm(!showVisitaForm)}
                >
                  <UserPlus className="size-5" /> REGISTRAR VISITA
                </Button>
              </div>

              {showVisitaForm && (
                <form onSubmit={handleVisitaSubmit} className="space-y-4 p-5 sm:p-6 rounded-3xl animate-in zoom-in-95 fade-in duration-200" style={{ backgroundColor: `${VERDE}0d`, border: `1px solid ${VERDE}1a` }}>
                  <p className="text-[12px] font-black uppercase tracking-widest" style={{ color: VERDE }}>Datos de la Visita</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <Input placeholder="Nombre completo *" className="bg-white border-none rounded-xl h-11 px-4 font-bold"
                        value={visitaData.nombre}
                        onChange={(e) => handleVisitaNombreChange(e.target.value)}
                        onFocus={() => searchVisitaHistory(visitaData.nombre)}
                        onBlur={() => setTimeout(() => setVisitaSuggestions([]), 150)}
                        required />
                      {visitaSuggestions.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                          {visitaSuggestions.map((s, i) => (
                            <button type="button" key={i} onMouseDown={(e) => e.preventDefault()} onClick={() => pickVisitaSuggestion(s)}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-b-0">
                              <p className="text-[13px] font-bold text-slate-700">{s.nombre_manual}</p>
                              <p className="text-[11px] text-slate-400">
                                {s.unidad_destino ? `Unidad ${s.unidad_destino}` : 'Sin unidad'}{s.patente ? ` · ${s.patente}` : ''}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input placeholder="RUT (sin puntos ni guión)" className="bg-white border-none rounded-xl h-11 px-4 font-bold"
                      value={visitaData.rut}
                      onChange={(e) => setVisitaData({ ...visitaData, rut: e.target.value })}
                      onBlur={(e) => lookupVisitaByRut(e.target.value)} />
                    <Input placeholder="Unidad que visita *" className="bg-white border-none rounded-xl h-11 px-4 font-bold"
                      value={visitaData.unidad_destino}
                      onChange={(e) => setVisitaData({ ...visitaData, unidad_destino: e.target.value })} required />
                    <Input placeholder="Motivo (visita, delivery, servicio…)" className="bg-white border-none rounded-xl h-11 px-4 font-bold"
                      value={visitaData.motivo}
                      onChange={(e) => setVisitaData({ ...visitaData, motivo: e.target.value })} />
                    <div className="flex flex-col gap-1.5">
                      <Input placeholder={visitaData.tieneVehiculo ? "Patente *" : "Patente (opcional)"} maxLength={6}
                        className="bg-white border-none rounded-xl h-11 px-4 font-black uppercase"
                        value={visitaData.patente}
                        onChange={(e) => setVisitaData({ ...visitaData, patente: sanitizePatente(e.target.value), tieneVehiculo: e.target.value ? true : visitaData.tieneVehiculo })}
                        required={visitaData.tieneVehiculo} />
                      <label className="flex items-center gap-2 px-1 text-[12px] font-bold text-slate-500 select-none">
                        <input type="checkbox" className="size-4" style={{ accentColor: VERDE }} checked={visitaData.tieneVehiculo}
                          onChange={(e) => setVisitaData({ ...visitaData, tieneVehiculo: e.target.checked })} />
                        Viene en vehículo
                      </label>
                    </div>
                    <Input placeholder="Observación" className="bg-white border-none rounded-xl h-11 px-4 font-bold"
                      value={visitaData.observacion}
                      onChange={(e) => setVisitaData({ ...visitaData, observacion: e.target.value })} />
                  </div>
                  <Button className="w-full text-white rounded-xl h-12 font-black shadow-lg gap-2" style={{ backgroundColor: VERDE }} type="submit" disabled={isProcessing === 'visita'}>
                    {isProcessing === 'visita' ? <Loader2 className="animate-spin size-6" /> : <><UserPlus className="size-5" /> REGISTRAR VISITA</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="2xl:col-span-5 space-y-6">

          {/* Selector de fecha */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("size-10 sm:size-11 rounded-2xl flex items-center justify-center shrink-0", selectedViewDate !== todayStr && "bg-amber-50")}
                  style={selectedViewDate === todayStr ? { backgroundColor: `${VERDE}1a` } : undefined}>
                  <CalendarDays className={cn("size-5 sm:size-6", selectedViewDate !== todayStr && "text-amber-600")}
                    style={selectedViewDate === todayStr ? { color: VERDE } : undefined} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Consultando</p>
                  <p className={cn("text-sm sm:text-base font-black truncate", selectedViewDate !== todayStr && "text-amber-600")}
                    style={selectedViewDate === todayStr ? { color: VERDE } : undefined}>
                    {selectedViewDate === todayStr ? "Hoy — Vista en vivo" : formatFecha(selectedViewDate + "T12:00:00")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedViewDate !== todayStr && (
                  <Button variant="outline" className="h-11 px-3 rounded-xl font-bold text-[12px] border-slate-200 text-slate-500 shrink-0"
                    onClick={() => setSelectedViewDate(todayStr)}>Hoy</Button>
                )}
                <input
                  type="date"
                  max={todayStr}
                  value={selectedViewDate}
                  onChange={(e) => setSelectedViewDate(e.target.value)}
                  className="flex-1 lg:flex-initial h-11 px-3 bg-slate-50 rounded-2xl text-base md:text-sm font-bold text-[#323232] border-none outline-none cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {selectedViewDate !== todayStr ? (
            /* VISTA HISTÓRICA */
            <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="p-5 sm:p-8 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-[#323232]">
                    {formatFecha(selectedViewDate + "T12:00:00")}
                  </CardTitle>
                  <Badge className="bg-amber-500 text-white px-3 h-7 font-bold text-[12px]">{historyLogs.length} registros</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 pt-0 space-y-2 max-h-[60vh] overflow-y-auto">
                {isHistoryLoading ? (
                  <div className="py-10 text-center"><Loader2 className="size-8 animate-spin mx-auto text-slate-300" /></div>
                ) : historyLogs.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock className="size-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Sin registros ese día</p>
                  </div>
                ) : historyLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-[#323232] text-base leading-tight">{nombreDeLog(log)}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleOpenEditLog(log)} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600">
                          <Edit2 className="size-4" />
                        </button>
                        <button onClick={() => handleDeleteLog(log)} disabled={isProcessing === `delete-${log.id}`} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-red-500">
                          {isProcessing === `delete-${log.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(log.unidad_destino || log.residente?.unidad) && (
                        <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase" style={{ color: VERDE }}>
                          Unidad {log.unidad_destino || log.residente?.unidad}
                        </span>
                      )}
                      <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-sky-600">
                        {formatHoraChile(log.hora_ingreso)}
                      </span>
                      <span className={cn("px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase", log.hora_salida ? "text-orange-600" : "text-amber-600")}>
                        {log.hora_salida ? formatHoraChile(log.hora_salida) : 'PENDIENTE'}
                      </span>
                      {log.patente && <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-slate-500">{log.patente}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* PERSONAS ADENTRO */}
              <Card className="border-2 shadow-xl rounded-[2rem] bg-white overflow-hidden" style={{ borderColor: `${VERDE}33` }}>
                <CardHeader className="p-5 sm:p-8 pb-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-[#323232]">Personas Adentro</CardTitle>
                    <Badge className="text-white px-3 h-7 font-bold text-[12px]" style={{ backgroundColor: VERDE }}>{activeEntries.length}</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input placeholder="Filtrar…" className="h-11 pl-9 bg-slate-50 border-none rounded-xl text-base md:text-sm font-bold"
                      value={activeSearchTerm} onChange={(e) => setActiveSearchTerm(e.target.value)} />
                  </div>
                </CardHeader>
                <CardContent className="p-5 sm:p-8 pt-0 space-y-2 max-h-[50vh] overflow-y-auto">
                  {activeEntries.length === 0 ? (
                    <div className="py-10 text-center">
                      <Home className="size-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Nadie adentro ahora</p>
                    </div>
                  ) : activeEntries.map(log => (
                    <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-black text-[#323232] text-base leading-tight">{nombreDeLog(log)}</p>
                        <Button
                          className="h-11 rounded-xl font-black px-4 bg-orange-500 hover:bg-orange-600 text-white gap-2 shrink-0"
                          onClick={() => handleRegisterExit(log)}
                          disabled={isProcessing === `exit-${log.id}`}
                        >
                          {isProcessing === `exit-${log.id}` ? <Loader2 className="animate-spin size-5" /> : <><LogOut className="size-5" /><span className="hidden sm:inline">Salida</span></>}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(log.unidad_destino || log.residente?.unidad) && (
                          <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase" style={{ color: VERDE }}>
                            Unidad {log.unidad_destino || log.residente?.unidad}
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-sky-600">
                          Ingresó {formatHoraChile(log.hora_ingreso)}
                        </span>
                        {log.patente && <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-slate-500">{log.patente}</span>}
                        {log.motivo && <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-amber-600">{log.motivo}</span>}
                        <button onClick={() => handleOpenEditLog(log)} className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600">
                          <Edit2 className="size-4" />
                        </button>
                        <button onClick={() => handleDeleteLog(log)} disabled={isProcessing === `delete-${log.id}`} className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-red-500">
                          {isProcessing === `delete-${log.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* SALIDAS HOY */}
              <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                <CardHeader className="p-5 sm:p-8 pb-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-[#323232]">Salidas Hoy</CardTitle>
                    <Badge className="bg-orange-500 text-white px-3 h-7 font-bold text-[12px]">{recentExits.length}</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input placeholder="Filtrar…" className="h-11 pl-9 bg-slate-50 border-none rounded-xl text-base md:text-sm font-bold"
                      value={exitsSearchTerm} onChange={(e) => setExitsSearchTerm(e.target.value)} />
                  </div>
                </CardHeader>
                <CardContent className="p-5 sm:p-8 pt-0 space-y-2 max-h-[40vh] overflow-y-auto">
                  {recentExits.length === 0 ? (
                    <div className="py-10 text-center">
                      <LogOut className="size-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">Sin salidas hoy</p>
                    </div>
                  ) : recentExits.map(log => (
                    <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-[#323232] text-base leading-tight">{nombreDeLog(log)}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleOpenEditLog(log)} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600">
                            <Edit2 className="size-4" />
                          </button>
                          <button onClick={() => handleDeleteLog(log)} disabled={isProcessing === `delete-${log.id}`} className="size-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-red-500">
                            {isProcessing === `delete-${log.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(log.unidad_destino || log.residente?.unidad) && (
                          <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase" style={{ color: VERDE }}>
                            Unidad {log.unidad_destino || log.residente?.unidad}
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-sky-600">{formatHoraChile(log.hora_ingreso)}</span>
                        <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-orange-600">{formatHoraChile(log.hora_salida)}</span>
                        {log.patente && <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-black uppercase text-slate-500">{log.patente}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* DIÁLOGO INGRESO (elección de patente) */}
      <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto sm:max-w-md max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Registrar Ingreso</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-base">
              {selectedPersona ? `${selectedPersona.nombre} ${selectedPersona.apellido}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-[12px] font-black uppercase tracking-widest" style={{ color: VERDE }}>Patente</Label>
              <div className="flex flex-wrap gap-2">
                {selectedPersona && getPatenteOptions(selectedPersona, entryTipo).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPatente(p)}
                    className={cn(
                      "h-11 px-4 rounded-xl border-2 font-black text-sm uppercase transition-all",
                      selectedPatente === p ? "text-white" : "border-slate-100 bg-slate-50 text-slate-500"
                    )}
                    style={selectedPatente === p ? { backgroundColor: VERDE, borderColor: VERDE } : undefined}
                  >{p}</button>
                ))}
              </div>
              <Input
                placeholder="Otra patente" maxLength={6}
                className="h-11 rounded-xl bg-slate-50 border-none font-black uppercase"
                value={selectedPatente}
                onChange={(e) => setSelectedPatente(sanitizePatente(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Observación</Label>
              <Input
                placeholder="Opcional"
                className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={entryObservacion}
                onChange={(e) => setEntryObservacion(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11 rounded-xl font-bold border-slate-200" onClick={() => setIsEntryDialogOpen(false)}>Cancelar</Button>
            <Button className="h-11 rounded-xl font-black text-white gap-2" style={{ backgroundColor: VERDE }} onClick={confirmEntry} disabled={!!isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin size-5" /> : <><LogIn className="size-5" /> Confirmar ingreso</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO SALIDA */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto sm:max-w-md max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Registrar Salida</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-base">
              {selectedLogForExit ? nombreDeLog(selectedLogForExit) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-[12px] font-black uppercase tracking-widest text-orange-600">Patente de salida</Label>
              <div className="flex flex-wrap gap-2">
                {exitPersonaRecord?.persona && getPatenteOptions(exitPersonaRecord.persona, exitPersonaRecord.tipo).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setExitPatente(p)}
                    className={cn(
                      "h-11 px-4 rounded-xl border-2 font-black text-sm uppercase transition-all",
                      exitPatente === p ? "bg-orange-500 border-orange-500 text-white" : "border-slate-100 bg-slate-50 text-slate-500"
                    )}
                  >{p}</button>
                ))}
              </div>
              <Input
                placeholder="Otra patente" maxLength={6}
                className="h-11 rounded-xl bg-slate-50 border-none font-black uppercase"
                value={exitPatente}
                onChange={(e) => setExitPatente(sanitizePatente(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Observación</Label>
              <Input
                placeholder="Opcional"
                className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={exitObservacion}
                onChange={(e) => setExitObservacion(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11 rounded-xl font-bold border-slate-200" onClick={() => setIsExitDialogOpen(false)}>Cancelar</Button>
            <Button className="h-11 rounded-xl font-black bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={confirmExit} disabled={!!isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin size-5" /> : <><LogOut className="size-5" /> Confirmar salida</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO EDITAR REGISTRO */}
      <Dialog open={isEditLogDialogOpen} onOpenChange={setIsEditLogDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto sm:max-w-lg max-w-lg rounded-[2rem] p-6 sm:p-8 bg-white border-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Corregir Registro</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-base">
              {editingLog ? nombreDeLog(editingLog) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {editingLog && !editingLog.residente_id && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Nombre</Label>
                <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                  value={editLogForm.nombre_manual}
                  onChange={(e) => setEditLogForm({ ...editLogForm, nombre_manual: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Unidad</Label>
              <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={editLogForm.unidad_destino}
                onChange={(e) => setEditLogForm({ ...editLogForm, unidad_destino: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Motivo</Label>
              <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={editLogForm.motivo}
                onChange={(e) => setEditLogForm({ ...editLogForm, motivo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Patente</Label>
              <Input className="h-11 rounded-xl bg-slate-50 border-none font-black uppercase" maxLength={6}
                value={editLogForm.patente}
                onChange={(e) => setEditLogForm({ ...editLogForm, patente: sanitizePatente(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Observación</Label>
              <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={editLogForm.observacion}
                onChange={(e) => setEditLogForm({ ...editLogForm, observacion: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-sky-600">Hora de ingreso</Label>
              <Input type="datetime-local" className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={editLogForm.hora_ingreso}
                onChange={(e) => setEditLogForm({ ...editLogForm, hora_ingreso: e.target.value })} />
            </div>
            {/* El campo de salida se muestra siempre (incluso si el registro sigue
                pendiente): es la única forma de cerrar un ingreso antiguo que ya
                no aparece en "Personas Adentro". */}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-orange-600">Hora de salida</Label>
              <Input type="datetime-local" className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                value={editLogForm.hora_salida}
                onChange={(e) => setEditLogForm({ ...editLogForm, hora_salida: e.target.value })} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11 rounded-xl font-bold border-slate-200" onClick={() => setIsEditLogDialogOpen(false)}>Cancelar</Button>
            <Button className="h-11 rounded-xl font-black text-white" style={{ backgroundColor: VERDE }} onClick={handleSaveEditLog} disabled={isSavingEditLog}>
              {isSavingEditLog ? <Loader2 className="animate-spin size-5" /> : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col items-center gap-1 pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plataforma impulsada por</p>
        <img src="/syntara-badge.png" alt="Syntara" className="h-16 w-auto object-contain" />
      </div>
    </div>
  )
}
