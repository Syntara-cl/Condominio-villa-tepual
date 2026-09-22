"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, Loader2 } from "lucide-react"
import { Button } from "@/components/uib/button"
import { Input } from "@/components/uib/input"
import { Label } from "@/components/uib/label"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [rut, setRut] = useState("")
  const [password, setPassword] = useState("")
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut, password }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result?.error || "No se pudo iniciar sesión.")
      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo iniciar sesión.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative"
      style={{ backgroundImage: "url(/login-bg.jpg)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 sm:p-9 space-y-5"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo-condominio.png" alt="Condominio Villa Tepual" className="h-16 w-auto object-contain" />
          <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide leading-snug px-2">
            Bienvenido a la plataforma de gestión del Condominio Villa Tepual
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rut" className="text-[12px] font-black uppercase tracking-widest text-slate-500">RUT</Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="rut"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12345678"
                autoComplete="username"
                className="h-12 rounded-xl bg-slate-50 border-none font-bold pl-10"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[12px] font-black uppercase tracking-widest text-slate-500">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 rounded-xl bg-slate-50 border-none font-bold pl-10"
                required
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={enviando}
          className="w-full h-12 rounded-xl bg-[#145F87] hover:bg-[#104c6c] text-white font-black shadow-lg shadow-[#145F87]/20"
        >
          {enviando ? <Loader2 className="animate-spin size-5" /> : "Iniciar Sesión"}
        </Button>

        <div className="flex justify-center pt-1">
          <img src="/syntara-badge.png" alt="Syntara — Automatización y software a medida" className="h-14 w-auto object-contain" />
        </div>
      </form>
    </div>
  )
}
