// app/api/customers/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  await requireAuth()
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } })
  return Response.json(customers)
}

export async function POST(request: Request) {
  await requireAuth()

  let name: string | null = null
  let code: string | null = null
  let contact: string | null = null
  let email: string | null = null
  let phone: string | null = null
  let address: string | null = null
  let isFormSubmission = false

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json()
    name = body.name
    code = body.code
    contact = body.contact
    email = body.email
    phone = body.phone
    address = body.address
  } else {
    // Handle URL-encoded form data (native HTML form submission)
    isFormSubmission = true
    const formData = await request.formData()
    name = formData.get('name') as string | null
    code = formData.get('code') as string | null
    contact = formData.get('contact') as string | null
    email = formData.get('email') as string | null
    phone = formData.get('phone') as string | null
    address = formData.get('address') as string | null
  }

  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const customer = await prisma.customer.create({ data: { name, code, contact, email, phone, address } })

  if (isFormSubmission) {
    return NextResponse.redirect(new URL('/customers', request.url))
  }

  return Response.json(customer, { status: 201 })
}
