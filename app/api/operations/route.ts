// app/api/operations/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  await requireAuth()
  const operations = await prisma.operation.findMany({ orderBy: { name: 'asc' } })
  return Response.json(operations)
}

export async function POST(request: Request) {
  await requireAuth()

  let name: string | null = null
  let code: string | null = null
  let description: string | null = null
  let isFormSubmission = false

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json()
    name = body.name
    code = body.code
    description = body.description
  } else {
    // Handle URL-encoded form data (native HTML form submission)
    isFormSubmission = true
    const formData = await request.formData()
    name = formData.get('name') as string | null
    code = formData.get('code') as string | null
    description = formData.get('description') as string | null
  }

  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  const op = await prisma.operation.create({ data: { name, code, description } })

  if (isFormSubmission) {
    return NextResponse.redirect(new URL('/operations', request.url))
  }

  return Response.json(op, { status: 201 })
}
