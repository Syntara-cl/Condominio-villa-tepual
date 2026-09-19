# Portería — Condominio Villa Tepual

Control de ingresos y salidas del condominio: residentes, visitas frecuentes
(personal de servicio autorizado) y visitas puntuales, con reportes en Excel.

Primer cliente de Syntara. El módulo es una adaptación del control de portería
del ERP Tresol al dominio residencial.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres) · Vercel

## Puesta en marcha

```bash
npm install
cp .env.local.example .env.local   # completar las 3 variables
npm run dev
```

### Base de datos

Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto Supabase. Crea las
tablas, los índices, los triggers de auditoría y deja RLS activo.

### Primer usuario

No hay registro público: las cuentas las crea la administración. Para el primero:

```bash
node scripts/hash-password.mjs "la-clave-elegida"
```

y con el hash resultante:

```sql
insert into usuarios (nombre, rut, password_hash, rol)
values ('Nombre Apellido', '12345678', 'scrypt$...', 'admin');
```

El RUT se guarda sin puntos, sin guión y sin dígito verificador separado — es la
misma forma en que lo normaliza el login.

## Cómo está organizado

| Ruta | Qué hace |
|---|---|
| `/login` | Ingreso con RUT + contraseña (bloqueo tras 5 intentos fallidos) |
| `/porteria` | Módulo principal: registro, personas adentro, salidas, historial, reportes |
| `/api/proxy` | Único punto de acceso a la base: valida sesión, rol y tabla |

### Modelo de datos

| Tabla | Para qué |
|---|---|
| `usuarios` | Conserjes y administración |
| `residentes` | Padrón del condominio, con su unidad |
| `visitas_frecuentes` | Personal de servicio recurrente autorizado |
| `logs_porteria` | Cada ingreso y su salida |
| `porteria_patentes` | Historial de patentes vistas por persona |
| `audit_log` | Quién cambió qué, en todas las tablas anteriores |

## Decisiones de diseño

- **La salida es decisión del conserje — nunca se cierra un ingreso solo.** Un
  registro sin salida ("PENDIENTE") es un estado válido: cerrarlo por defecto
  falsearía el libro marcando salidas que pudieron no ocurrir.
- **Las patentes se acumulan, no se sobrescriben.** Si una persona tiene más de
  una patente conocida, el conserje elige cuál corresponde ese día en vez de que
  el sistema adivine.
- **Visitas frecuentes en tabla aparte de residentes.** Son externas al
  condominio y no deben mezclarse con el padrón que se usa para cobros,
  asambleas o notificaciones.
- **Todo pasa por el proxy.** El navegador nunca habla directo con Supabase; la
  clave con privilegios vive solo en el servidor y RLS queda sin políticas
  permisivas como segunda barrera.
- **Hora de Chile explícita.** Los días se calculan en `America/Santiago`, no en
  la zona del navegador ni en UTC, para que el turno de noche no parta el día.

## Pendiente

- Cargar el padrón real de residentes de Villa Tepual.
- Definir con la administración si se necesita control de encomiendas.
- Deploy en Vercel apuntando al proyecto Supabase del condominio.
