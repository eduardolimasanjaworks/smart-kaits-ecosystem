import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/cupom") || pathname.startsWith("/api/cupons/resgatar")) {
    return NextResponse.next();
  }

  const possuiAcesso = request.cookies.has("yex_auth");

  if (!possuiAcesso && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (possuiAcesso && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/cupom/:path*"],
};
