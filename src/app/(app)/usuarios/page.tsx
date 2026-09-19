"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, KeyRound, Power, Loader2, Users2 } from "lucide-react"
import { Button } from "@/components/uib/button"
import { Input } from "@/components/uib/input"
import { Label } from "@/components/uib/label"
import { Badge } from "@/components/uib/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/uib/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const VERDE = "#2D6A4F"

type Usuario = {
  id: string
  nombre: string
  rut: string
  rol: "conserje" | "admin"
  activo: boolean
  ultimo_acceso: string | null
  bloqueado_hasta: string | null
  created_at: string
}

export default function UsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [newForm, setNewForm] = useState({ nombre: "", rut: "", password: "", rol: "conserje" as "conserje" | "admin" })
  const [isSavingNew, setIsSavingNew] = useState(false)

  const [resetTarget, setResetTarget] = useState<Usuario | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [isSavingReset, setIsSavingReset] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!u || u.rol !== "admin") {
          router.push("/dashboard")
          return
        }
        fetchUsuarios()
      })
      .catch(() => router.push("/dashboard"))
  }, [router])

  const fetchUsuarios = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/usuarios")
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || "No se pudieron cargar los usuarios.")
      setUsuarios(result.data || [])
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar los usuarios.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingNew(true)
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || "No se pudo crear el usuario.")
      toast.success("Usuario creado.")
      setIsNewOpen(false)
      setNewForm({ nombre: "", rut: "", password: "", rol: "conserje" })
      fetchUsuarios()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el usuario.")
    } finally {
      setIsSavingNew(false)
    }
  }

  const handleToggleActivo = async (usuario: Usuario) => {
    setBusy(usuario.id)
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !usuario.activo }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || "No se pudo actualizar el usuario.")
      toast.success(usuario.activo ? "Usuario desactivado." : "Usuario activado.")
      fetchUsuarios()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el usuario.")
    } finally {
      setBusy(null)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setIsSavingReset(true)
    try {
      const res = await fetch(`/api/usuarios/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || "No se pudo restablecer la contraseña.")
      toast.success("Contraseña actualizada.")
      setResetTarget(null)
      setResetPassword("")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo restablecer la contraseña.")
    } finally {
      setIsSavingReset(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-black text-[#323232] uppercase tracking-tight leading-tight">Gestión de Usuarios</h1>

        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <Button className="h-11 rounded-xl font-bold gap-2 text-white shadow-lg" style={{ backgroundColor: VERDE }} onClick={() => setIsNewOpen(true)}>
            <UserPlus className="size-5" />
            Nuevo usuario
          </Button>
          <DialogContent className="max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
            <DialogHeader className="space-y-3">
              <div className="size-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}>
                <UserPlus className="size-7" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Nuevo usuario</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium">Conserje o administrador con acceso al sistema.</DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Nombre completo</Label>
                <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold" required
                  value={newForm.nombre} onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-black uppercase tracking-widest text-slate-500">RUT</Label>
                <Input className="h-11 rounded-xl bg-slate-50 border-none font-bold" placeholder="12345678-9" required
                  value={newForm.rut} onChange={(e) => setNewForm({ ...newForm, rut: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Contraseña</Label>
                <Input type="password" className="h-11 rounded-xl bg-slate-50 border-none font-bold" required minLength={6}
                  value={newForm.password} onChange={(e) => setNewForm({ ...newForm, password: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Rol</Label>
                <div className="flex gap-2">
                  {(["conserje", "admin"] as const).map((rol) => (
                    <button
                      key={rol}
                      type="button"
                      onClick={() => setNewForm({ ...newForm, rol })}
                      className={cn(
                        "flex-1 h-11 rounded-xl font-black uppercase tracking-widest text-[12px] transition-colors",
                        newForm.rol === rol ? "text-white" : "bg-slate-50 text-slate-400"
                      )}
                      style={newForm.rol === rol ? { backgroundColor: VERDE } : undefined}
                    >
                      {rol}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="h-11 rounded-xl font-bold border-slate-200" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSavingNew} className="h-11 rounded-xl font-black text-white" style={{ backgroundColor: VERDE }}>
                  {isSavingNew ? <Loader2 className="animate-spin size-5" /> : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 font-bold">
            <Loader2 className="animate-spin size-6 mr-2" /> Cargando usuarios...
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Users2 className="size-10 text-slate-300" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sin usuarios registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-[#323232] uppercase tracking-tight">{u.nombre}</p>
                    <Badge className="uppercase text-[10px] font-black" style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}>{u.rol}</Badge>
                    {!u.activo && <Badge className="uppercase text-[10px] font-black bg-red-50 text-red-600">Inactivo</Badge>}
                    {u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date() && (
                      <Badge className="uppercase text-[10px] font-black bg-amber-50 text-amber-600">Bloqueado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">{u.rut}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl font-bold border-slate-200 text-slate-500 gap-2"
                    onClick={() => { setResetTarget(u); setResetPassword("") }}
                  >
                    <KeyRound className="size-4" />
                    <span className="hidden sm:inline">Restablecer clave</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={cn("h-10 rounded-xl font-bold border-slate-200 gap-2", u.activo ? "text-red-600" : "text-emerald-600")}
                    disabled={busy === u.id}
                    onClick={() => handleToggleActivo(u)}
                  >
                    {busy === u.id ? <Loader2 className="animate-spin size-4" /> : <Power className="size-4" />}
                    <span className="hidden sm:inline">{u.activo ? "Desactivar" : "Activar"}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(o: boolean) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="size-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${VERDE}1a`, color: VERDE }}>
              <KeyRound className="size-7" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#323232]">Restablecer contraseña</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">{resetTarget?.nombre}</DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Nueva contraseña</Label>
              <Input type="password" className="h-11 rounded-xl bg-slate-50 border-none font-bold" required minLength={6}
                value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl font-bold border-slate-200" onClick={() => setResetTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={isSavingReset} className="h-11 rounded-xl font-black text-white" style={{ backgroundColor: VERDE }}>
                {isSavingReset ? <Loader2 className="animate-spin size-5" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
