// Aislado en su propio módulo, sin imports: lo necesita tanto el servidor
// (session.ts, que carga crypto de Node) como el proxy de borde, que no puede
// cargar módulos de Node.
export const SESSION_COOKIE = "vt_session"
