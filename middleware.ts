// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'mes-secret-key-change-in-production-32chars'
)

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths (including NextAuth OAuth callbacks)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow Next.js internal paths and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('mes_session')?.value
  const hasNextAuthToken = request.cookies.getAll().some(c => 
    c.name.includes('authjs.session-token') || c.name.includes('next-auth.session-token')
  )

  if (!token && !hasNextAuthToken) {
    // API routes get 401, pages get redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token) {
    try {
      await jwtVerify(token, SECRET_KEY)
      return NextResponse.next()
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 })
      }
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('mes_session')
      return response
    }
  }

  // If we only have next-auth session, let next-auth handle validation
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
