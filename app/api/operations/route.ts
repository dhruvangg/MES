// app/api/operations/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await requireAuth()
  const operations = await prisma.operation.findMany({ orderBy: { name: 'asc' } })
  return Response.json(operations)
}

export async function POST(request: Request) {
  await requireAuth()
  const { name, code, description } = await request.json()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const op = await prisma.operation.create({ data: { name, code, description } })
  return Response.json(op, { status: 201 })
}
