"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, ShieldCheck, Power, ChevronRight } from "lucide-react"
import { Button } from "@/components/uib/button"

const VERDE = "#2D6A4F"

type Sesion = { id: string; nombre: string; rol: string }

const MODULOS = [
  {
    href: "/porteria",
    nombre: "Portería",
    descripcion: "Control de ingresos y salidas del condominio.",
    icon: ShieldCheck,
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [sesion, setSesion] = useState<Sesion | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setSesion(u))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-3 sm:p-4 md:p-10 space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="size-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
            style={{ backgroundColor: VERDE, boxShadow: `0 10px 25px -5px ${VERDE}40` }}
          >
            <Shield className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#323232] uppercase tracking-tight leading-tight">
              Condominio Villa Tepual
            </h1>
            <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Panel General
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sesion && (
            <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
              {sesion.nombre}
            </p>
          )}
          <Button
            variant="outline"
            className="h-11 rounded-xl font-bold border-slate-200 text-slate-500 gap-2"
            onClick={handleLogout}
          >
            <Power className="size-5" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULOS.map((modulo) => (
          <Link
            key={modulo.href}
            href={modulo.href}
            className="bg-white rounded-3xl shadow-xl p-6 flex items-center gap-4 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            <div
              className="size-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}
            >
              <modulo.icon className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-[#323232] uppercase tracking-tight">{modulo.nombre}</h2>
              <p className="text-sm text-slate-400 font-medium mt-0.5">{modulo.descripcion}</p>
            </div>
            <ChevronRight className="size-5 text-slate-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
