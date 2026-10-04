<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Portería — Condominio Villa Tepual

Primer cliente de **Syntara** (proyecto independiente de Tresol: no usar su
infraestructura, credenciales ni base de datos). El módulo nació como una
adaptación del control de portería del ERP Tresol al dominio residencial.

**Referencia de patrones:** `C:\Users\fabia\Desktop\Tresol\tresol\` es de
**solo lectura** — sirve para extraer ideas, patrones de UI o soluciones ya
probadas (ej. el módulo de portería original, `export-excel.ts`,
`passwordHash.ts`). Nunca escribir ni modificar nada ahí desde este proyecto.

## Reglas de negocio que no se rompen

- **La salida la decide el conserje — nunca cerrar un ingreso automáticamente.**
  Un registro sin `hora_salida` ("PENDIENTE") es un estado válido. No agregar
  jobs de auto-cierre ni rellenar salidas por defecto: falsearía el libro de
  portería marcando salidas que pudieron no ocurrir.
- **Las patentes se acumulan, nunca se sobrescriben.** `porteria_patentes` es
  append-only. Si una persona tiene 2+ patentes conocidas, el conserje elige;
  el sistema no adivina.
- **Residentes y visitas frecuentes son tablas separadas.** Las visitas
  frecuentes son externas al condominio y no deben entrar al padrón que se usa
  para cobros, asambleas o notificaciones.

## Seguridad

- El navegador **nunca** habla directo con Supabase. Todo pasa por
  `/api/proxy`, que valida sesión, rol y tabla contra una whitelist.
- La `service_role` key vive solo en el servidor. RLS queda activo y **sin
  políticas permisivas** como segunda barrera.
- `registrado_por_id` / `salida_por_id` los escribe el servidor desde la
  sesión, nunca el cliente: si no, cualquiera podría firmar un movimiento a
  nombre de otro conserje.
- Al crear una tabla nueva: agregarla a `PERMISOS` en el proxy, activar RLS y
  aplicarle el trigger de auditoría (`select aplicar_auditoria('tabla')`).

## Convenciones

- **Fechas visibles al usuario: siempre `dd/mm/aa`** vía `formatFecha()` de
  `@/lib/utils`. Nunca redefinir una versión local de esa función.
- **Español latinoamericano neutro, nunca voseo** ("elige", no "elegís") en
  todo texto de cara al usuario: copys, errores, toasts, exports.
- **Los días se calculan en `America/Santiago`** (`getChileDateStr`), no en la
  zona del navegador ni en UTC — si no, el turno de noche parte el día mal.
- **Responsive obligatorio.** El conserje puede estar en un PC de garita o en
  un celular: botones de acción `h-11`, tablas con `overflow-x-auto`, modales
  con `max-h-[85vh] overflow-y-auto`.

## Verificar antes de dar algo por terminado

```bash
npx tsc --noEmit && npx next build
```

## Skills del proyecto y cómo trabajar aquí (gerente, jefes y workers)

Las skills propias de este proyecto están en `.claude/skills/` (Claude) y `.agents/skills/` (Codex y
Gemini/Antigravity), con el mismo contenido. **El mapa de qué skill usa cada rol está en `SKILLS.md`:
léelo antes de empezar.** Las reglas de riesgo (R0/R1/R2) de este proyecto están en
`~/.claude/org/riesgo/Condominio-villa-tepual.txt`. Este proyecto es independiente del CRM
(`sii-prototype`): no mezclar código, tablas, cuentas ni credenciales entre los dos.
