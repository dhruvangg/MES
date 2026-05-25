// app/api/customers/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await requireAuth()
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } })
  return Response.json(customers)
}

export async function POST(request: Request) {
  await requireAuth()
  const { name, code, contact, email, phone, address } = await request.json()
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const customer = await prisma.customer.create({ data: { name, code, contact, email, phone, address } })
  return Response.json(customer, { status: 201 })
}
