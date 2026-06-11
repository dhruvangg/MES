// app/api/parts/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  await requireAuth()
  const parts = await prisma.part.findMany({ orderBy: { name: 'asc' } })
  return Response.json(parts)
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

  const part = await prisma.part.create({ data: { name, code, description } })

  if (isFormSubmission) {
    return NextResponse.redirect(new URL('/parts', request.url))
  }

  return Response.json(part, { status: 201 })
}
