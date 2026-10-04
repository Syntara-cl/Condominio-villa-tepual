---
name: reglas-porteria
description: Reglas de negocio del libro de portería de Villa Tepual (ingresos, salidas, patentes, residentes y visitas frecuentes). Usar antes de tocar cualquier cosa de src/app/(app)/porteria, logs_porteria, porteria_patentes, residentes o visitas_frecuentes, o al diseñar un módulo nuevo de portería (paquetería, vehículos, autorizaciones).
---

# Reglas de portería (no se rompen)

1. **La salida la decide el conserje.** Nunca cerrar un ingreso automáticamente: ni jobs de auto-cierre ni
   `hora_salida` por defecto. Un registro sin `hora_salida` ("PENDIENTE") es un estado válido; rellenarlo
   falsearía el libro marcando salidas que pudieron no ocurrir.
2. **Las patentes se acumulan, nunca se sobrescriben.** `porteria_patentes` es append-only. Con 2+ patentes
   conocidas para una persona, el conserje elige; el sistema no adivina.
3. **Residentes y visitas frecuentes son tablas separadas.** Las visitas frecuentes son externas al condominio
   y no entran al padrón usado para cobros, asambleas o notificaciones.
4. **Autor siempre del servidor.** `registrado_por_id` y `salida_por_id` los escribe el servidor desde la
   sesión, jamás el cliente.
5. **Días en `America/Santiago`** (`getChileDateStr`), no en la zona del navegador ni en UTC: si no, el turno
   de noche parte el día mal.
6. **Fechas visibles `dd/mm/aa`** con `formatFecha()` de `@/lib/utils`; no crear versiones locales.

## Al agregar un módulo nuevo de portería
Aplicar las mismas ideas: lo que el conserje registra es un hecho que ocurrió (no se autocompleta); los
catálogos (residentes, proveedores) van separados de los eventos; todo evento guarda quién lo registró y cuándo.
El patrón de módulos está en `src/lib/modulos.ts`. Tabla nueva → ver la skill `proxy-supabase`.

## Aceptación típica
Un test o un recorrido observable: "registro un ingreso, queda PENDIENTE; el conserje marca salida y queda
firmado con su usuario; reintento de patente existente no la duplica ni la pisa".
