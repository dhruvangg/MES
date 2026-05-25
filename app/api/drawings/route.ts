// app/api/drawings/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await requireAuth()
  const drawings = await prisma.drawing.findMany({ orderBy: { number: 'asc' } })
  return Response.json(drawings)
}

export async function POST(request: Request) {
  await requireAuth()
  const { number, revision, notes } = await request.json()
  if (!number) return Response.json({ error: 'Drawing number required' }, { status: 400 })

  const drawing = await prisma.drawing.create({ data: { number, revision, notes } })
  return Response.json(drawing, { status: 201 })
}
