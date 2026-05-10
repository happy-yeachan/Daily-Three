import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const DEV_FALLBACK_SECRET = 'daily-three-local-dev-secret-change-in-production'

const getSecret = () => {
  const env = process.env.JWT_SECRET
  if (env && env.length >= 16) return new TextEncoder().encode(env)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set or is too short (minimum 16 characters required in production).')
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET)
}

const PUBLIC_PATHS = ['/auth', '/api/auth']

const SESSION_DAYS = 30
const REFRESH_THRESHOLD_DAYS = 7   // 만료까지 N일 미만이면 자동 갱신
const SESSION_SEC = SESSION_DAYS * 86400
const REFRESH_THRESHOLD_SEC = REFRESH_THRESHOLD_DAYS * 86400

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
    const { payload } = await jwtVerify(token, getSecret())
    const response = NextResponse.next()

    // ── Rolling renewal: 만료까지 7일 미만이면 토큰 갱신 ──
    // 활성 사용자는 사실상 무기한 자동 로그인 → SMS 비용 절감
    const exp = typeof payload.exp === 'number' ? payload.exp : 0
    const now = Math.floor(Date.now() / 1000)
    const remainingSec = exp - now

    if (remainingSec > 0 && remainingSec < REFRESH_THRESHOLD_SEC) {
      const newToken = await new SignJWT({
        userId: payload.userId,
        phone: payload.phone,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(getSecret())

      response.cookies.set('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_SEC,
        path: '/',
      })
    }

    return response
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
