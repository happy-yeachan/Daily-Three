import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'daily-three-local-dev-secret-change-in-production'
  )

export async function createToken(userId: string, phone: string): Promise<string> {
  return await new SignJWT({ userId, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
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
