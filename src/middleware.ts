import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'daily-three-local-dev-secret-change-in-production'
  )

const PUBLIC_PATHS = ['/auth', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.cookies.delete('token')
      return res
    }
    const res = NextResponse.redirect(new URL('/auth', req.url))
    res.cookies.delete('token')
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
