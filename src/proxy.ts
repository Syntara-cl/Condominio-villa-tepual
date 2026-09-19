import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/sessionCookie"

// Solo comprueba presencia de cookie: corre en el borde y no puede usar crypto
// de Node. La validación real de la firma la hace cada route handler vía
// getSesion() — esto es únicamente para redirigir al login.
export function proxy(request: NextRequest) {
  const tieneCookie = !!request.cookies.get(SESSION_COOKIE)?.value
  const enLogin = request.nextUrl.pathname === "/login"

  if (!tieneCookie && !enLogin) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (tieneCookie && enLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
