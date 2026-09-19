"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Loader2 } from "lucide-react"
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
      router.push("/porteria")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo iniciar sesión.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 sm:p-9 space-y-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-14 rounded-2xl bg-[#2D6A4F] flex items-center justify-center shadow-lg shadow-[#2D6A4F]/25">
            <Shield className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#323232] uppercase tracking-tight">Portería</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Condominio Villa Tepual
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rut" className="text-[12px] font-black uppercase tracking-widest text-slate-500">RUT</Label>
            <Input
              id="rut"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12345678"
              autoComplete="username"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[12px] font-black uppercase tracking-widest text-slate-500">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={enviando}
          className="w-full h-12 rounded-xl bg-[#2D6A4F] hover:bg-[#245740] text-white font-black shadow-lg shadow-[#2D6A4F]/20"
        >
          {enviando ? <Loader2 className="animate-spin size-5" /> : "Entrar"}
        </Button>
      </form>
    </div>
  )
}
