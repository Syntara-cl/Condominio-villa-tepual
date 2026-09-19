"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/uib/card"
import { MODULOS, type Rol } from "@/lib/modulos"

const VERDE = "#2D6A4F"

type Sesion = { id: string; nombre: string; rol: Rol }

export default function DashboardPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setSesion(u))
      .catch(() => {})
  }, [])

  const modulos = MODULOS.filter((m) => !sesion || m.roles.includes(sesion.rol))
  const primerNombre = sesion?.nombre?.split(" ")[0] || "Usuario"

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: VERDE }}>Panel Personal</p>
        <h1 className="text-2xl sm:text-3xl font-black text-[#323232] tracking-tight">Bienvenido, {primerNombre}</h1>
        <p className="text-slate-500 font-medium">
          {modulos.length > 0
            ? `Tienes acceso a ${modulos.length} módulo${modulos.length !== 1 ? "s" : ""}.`
            : "No tienes módulos asignados aún."}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-5">
        {modulos.map((modulo) => (
          <Link key={modulo.href} href={modulo.href}>
            <Card className="group border-none shadow-lg hover:shadow-2xl rounded-[2rem] bg-white transition-all duration-300 overflow-hidden cursor-pointer h-full">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="p-3.5 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300"
                  style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}
                >
                  <modulo.icon className="size-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-black text-[#323232] uppercase tracking-tight">{modulo.nombre}</h3>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{modulo.descripcion}</p>
                </div>
                <div className="mt-auto flex justify-end pt-1">
                  <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center transition-all duration-300 group-hover:bg-[#2D6A4F] group-hover:text-white">
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
