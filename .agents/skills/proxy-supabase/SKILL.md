---
name: proxy-supabase
description: Cómo se accede a datos en Villa Tepual — el navegador nunca habla con Supabase, todo pasa por /api/proxy con whitelist de tabla, rol y método. Usar al crear o cambiar una tabla, un permiso, una consulta con joins, una migración SQL, o al tocar src/app/api/proxy, src/app/api/usuarios o src/lib/session*.
---

# Acceso a datos y seguridad (R2)

- **El navegador nunca habla directo con Supabase.** Todo va por `src/app/api/proxy/route.ts`, que valida
  sesión, rol y tabla contra el mapa `PERMISOS` (tabla → método → roles).
- La `service_role` vive solo en el servidor (`src/lib/supabase-admin.ts`). RLS queda activo y **sin
  políticas permisivas**: es la segunda barrera.
- Los `select` con relaciones embebidas solo se aceptan si están **exactos** en `SELECTS_CON_JOIN`; así no se
  arrastran columnas sensibles (p. ej. `usuarios.password_hash`). Un join nuevo se agrega ahí, nunca con comodines.

## Checklist al crear una tabla nueva
1. Migración SQL con RLS activado y sin políticas permisivas.
2. `select aplicar_auditoria('<tabla>')` para el trigger de auditoría.
3. Entrada en `PERMISOS` con el mínimo de roles por método (hoy: `conserje`, `admin`).
4. Si el autor del registro importa, que lo escriba el servidor desde la sesión.
5. Si hay joins, agregarlos exactos a `SELECTS_CON_JOIN`.

## Reglas operativas
- Ejecutar SQL contra la BD real, deploys, push, merge y credenciales: **solo el gerente**. Los jefes y workers
  escriben la migración como archivo, no la aplican, y nunca reciben `.env`.
- Cuentas oficiales: Vercel `syntarav`, GitHub `Syntara-cl`, Supabase org `Syntara`. Nunca las de Tresol ni otros
  clientes. `C:\Users\fabia\Desktop\Tresol\tresol\` es solo lectura (referencia de patrones).
- Todo cambio en esta área es **R2**: revisión cruzada por otro proveedor, aunque cambie una línea.
