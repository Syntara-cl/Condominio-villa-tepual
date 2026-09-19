"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Power, Loader2 } from "lucide-react"
import { MODULOS, type Rol } from "@/lib/modulos"
import { cn } from "@/lib/utils"

const VERDE = "#2D6A4F"

type Sesion = { id: string; nombre: string; rol: Rol }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u) => setSesion(u))
      .catch(() => router.push("/login"))
      .finally(() => setCargando(false))
  }, [router])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  if (cargando || !sesion) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Loader2 className="animate-spin size-8 text-slate-300" />
      </div>
    )
  }

  const modulos = MODULOS.filter((m) => m.roles.includes(sesion.rol))

  const NavLink = ({ href, nombre, icon: Icon }: { href: string; nombre: string; icon: typeof LayoutDashboard }) => {
    const activo = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
          activo ? "text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
        )}
        style={activo ? { backgroundColor: VERDE } : undefined}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{nombre}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#F5F7FA]">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-white shadow-xl">
        <div className="p-6">
          <img src="/logo-condominio.png" alt="Condominio Villa Tepual" className="h-12 w-auto object-contain" />
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLink href="/dashboard" nombre="Panel Personal" icon={LayoutDashboard} />
          {modulos.map((m) => (
            <NavLink key={m.id} href={m.href} nombre={m.nombre} icon={m.icon} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <p className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">{sesion.nombre}</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all"
          >
            <Power className="size-4" />
            Salir
          </button>
          <div className="flex flex-col items-center gap-1 pt-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Impulsado por</p>
            <img src="/syntara-badge.png" alt="Syntara" className="h-8 w-auto object-contain" />
          </div>
        </div>
      </aside>

      {/* Header móvil: sidebar colapsa en pantallas chicas, logo + salir arriba */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between gap-2 bg-white shadow-sm p-3">
          <img src="/logo-condominio.png" alt="Condominio Villa Tepual" className="h-8 w-auto object-contain shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            {[{ href: "/dashboard", nombre: "Panel Personal", icon: LayoutDashboard }, ...modulos].map((m) => {
              const activo = pathname === m.href || (m.href !== "/dashboard" && pathname.startsWith(m.href + "/"))
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  title={m.nombre}
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center shrink-0",
                    activo ? "text-white" : "text-slate-400"
                  )}
                  style={activo ? { backgroundColor: VERDE } : undefined}
                >
                  <m.icon className="size-4" />
                </Link>
              )
            })}
            <button onClick={handleLogout} className="size-9 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
              <Power className="size-4" />
            </button>
          </div>
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
