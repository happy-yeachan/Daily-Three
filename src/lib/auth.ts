import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const DEV_FALLBACK_SECRET = 'daily-three-local-dev-secret-change-in-production'

function resolveSecret(): Uint8Array {
  const env = process.env.JWT_SECRET
  if (env && env.length >= 16) {
    return new TextEncoder().encode(env)
  }
  // production에서 secret 미설정/취약 → 즉시 실패 (토큰 위조 방지)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is not set or is too short (minimum 16 characters required in production).'
    )
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET)
}

export async function createToken(userId: string, phone: string): Promise<string> {
  return await new SignJWT({ userId, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(resolveSecret())
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, resolveSecret())
    return payload as { userId: string; phone: string }
  } catch {
    return null
  }
}

export async function getSession(): Promise<{ userId: string; phone: string } | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}
