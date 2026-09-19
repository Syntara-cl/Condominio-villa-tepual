import { ShieldCheck, Users2, type LucideIcon } from "lucide-react"

export type Rol = "conserje" | "admin"

export type Modulo = {
  id: string
  href: string
  nombre: string
  descripcion: string
  icon: LucideIcon
  roles: Rol[]
}

export const MODULOS: Modulo[] = [
  {
    id: "porteria",
    href: "/porteria",
    nombre: "Portería",
    descripcion: "Control de ingresos y salidas del condominio.",
    icon: ShieldCheck,
    roles: ["conserje", "admin"],
  },
  {
    id: "usuarios",
    href: "/usuarios",
    nombre: "Usuarios",
    descripcion: "Cuentas de conserjes y administradores.",
    icon: Users2,
    roles: ["admin"],
  },
]
