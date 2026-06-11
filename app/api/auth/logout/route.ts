// app/api/auth/logout/route.ts
import { clearSessionCookie } from '@/lib/auth'
import { signOut } from '@/auth'

export async function POST() {
  await clearSessionCookie()
  try {
    await signOut({ redirect: false })
  } catch (err) {
    // Ignore next-auth internal redirect throws
  }
  return Response.json({ ok: true })
}
