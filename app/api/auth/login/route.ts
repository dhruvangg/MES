// app/api/auth/login/route.ts
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    await setSessionCookie(token)

    return Response.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    console.error('[login]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
