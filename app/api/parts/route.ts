// app/api/parts/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await requireAuth()
  const parts = await prisma.part.findMany({ orderBy: { name: 'asc' } })
  return Response.json(parts)
}

export async function POST(request: Request) {
  await requireAuth()
  const { name, code, description } = await request.json()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const part = await prisma.part.create({ data: { name, code, description } })
  return Response.json(part, { status: 201 })
}
