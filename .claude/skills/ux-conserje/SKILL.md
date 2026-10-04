---
name: ux-conserje
description: Estándares de interfaz de Villa Tepual pensados para el conserje en garita o celular (responsive, botones grandes, copy en español neutro, sistema de diseño y marca Syntara). Usar al crear o modificar cualquier pantalla, componente, copy o export.
---

# UX del conserje

El conserje trabaja rápido, de pie, a veces en un celular: la pantalla debe resolver su tarea en pocos toques.

- **Responsive obligatorio.** Botones de acción `h-11`; tablas con `overflow-x-auto`; modales con
  `max-h-[85vh] overflow-y-auto`.
- **Español latinoamericano neutro, sin voseo** ("elige", no "elegís") en copys, errores, toasts y exports.
- **Fechas `dd/mm/aa`** con `formatFecha()`. Días en `America/Santiago`.
- **Componentes:** usar `src/components/uib/` (badge, button, card, dialog, input, label) y el tema de
  `design-system/` del repo Syntara; peso de botón `font-extrabold`. No introducir otra librería de UI.
- **Marca:** el footer único con la firma de Syntara se mantiene actualizado; no duplicarlo en sidebar/header.
- Lo que el conserje decide (salida, elección de patente) nunca se autocompleta: ver `reglas-porteria`.

## Verificar antes de dar algo por terminado
```bash
npx tsc --noEmit && npx next build
```
Un solo `build` a la vez por máquina. Para UI nueva, mirar la pantalla en ancho de celular (~390 px) y de PC.
