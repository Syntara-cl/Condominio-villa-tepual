# Skills y roles — Condominio Villa Tepual

Proyecto independiente del CRM (`sii-prototype`). Su organización multi-IA es la global
(`~/.claude/org/`); aquí solo se dice qué skills de **este** proyecto aplica cada rol.

## Skills de este proyecto
(`.claude/skills/` para Claude, `.agents/skills/` para Codex y Gemini; mismo contenido)

| Skill | Cuándo |
|---|---|
| `reglas-porteria` | Cualquier cosa del libro de portería o módulos nuevos de portería |
| `proxy-supabase` | Tablas, permisos, SQL, joins, sesión/usuarios (todo R2) |
| `ux-conserje` | Cualquier pantalla, componente, copy o export |

## Quién usa qué
| Rol | Skills del proyecto | Además |
|---|---|---|
| Gerente (Claude o Sol) | las tres; decide R0/R1/R2 con `riesgo-diff.ps1` | skills globales de gestión |
| Jefe de área (Codex/Gemini) | las que pida el encargo; `proxy-supabase` siempre si hay SQL | `jefe-de-area` |
| Worker/subagente | solo las que cite su encargo | — |

## Reglas que no cambian
- SQL real, deploy, push, merge y credenciales: solo el gerente.
- Revisión cruzada obligatoria en `proxy-supabase` (R2).
- Verificar: `npx tsc --noEmit && npx next build`.
