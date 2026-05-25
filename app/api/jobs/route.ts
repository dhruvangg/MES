// app/api/jobs/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getJobDelayStatus } from '@/lib/qty'
import { generateJobNumber } from '@/lib/utils'
import type { CreateJobRequest } from '@/types'

export async function GET(request: Request) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customerId')

  const jobs = await prisma.job.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(priority ? { priority: priority as any } : {}),
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: { select: { name: true } },
      jobParts: {
        include: {
          routingSteps: {
            include: { operation: { select: { name: true } } },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  const result = jobs.map(job => {
    const allSteps = job.jobParts.flatMap(p => p.routingSteps)
    const activeStep = allSteps.find(s => s.status === 'IN_PROGRESS')
    const stepsTotal = allSteps.length
    const stepsDone = allSteps.filter(s => s.status === 'COMPLETED').length

    return {
      id: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customer.name,
      poNumber: job.poNumber,
      dueDate: job.dueDate?.toISOString() ?? null,
      priority: job.priority,
      status: job.status,
      delayStatus: getJobDelayStatus(job.dueDate, job.status),
      totalParts: job.jobParts.length,
      activeOperation: activeStep?.operation.name ?? null,
      stepsTotal,
      stepsDone,
    }
  })

  return Response.json(result)
}

export async function POST(request: Request) {
  const session = await requireAuth()
  const body: CreateJobRequest = await request.json()

  const { customerId, poNumber, dueDate, priority, notes, parts } = body

  if (!customerId || !parts?.length) {
    return Response.json({ error: 'Customer and at least one part required' }, { status: 400 })
  }

  const job = await prisma.$transaction(async (tx) => {
    const newJob = await tx.job.create({
      data: {
        jobNumber: generateJobNumber(),
        customerId,
        poNumber,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority ?? 'NORMAL',
        status: 'ACTIVE',
        notes,
      },
    })

    for (const part of parts) {
      const jobPart = await tx.jobPart.create({
        data: {
          jobId: newJob.id,
          partId: part.partId,
          drawingId: part.drawingId,
          totalQty: part.totalQty,
        },
      })

      // Create routing steps in sequence order
      const sortedRouting = [...part.routing].sort((a, b) => a.sequence - b.sequence)
      for (let i = 0; i < sortedRouting.length; i++) {
        const step = sortedRouting[i]
        await tx.routingStep.create({
          data: {
            jobPartId: jobPart.id,
            operationId: step.operationId,
            sequence: i + 1,
            status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
            qtyIn: i === 0 ? part.totalQty : 0,
            updatedById: session.id,
          },
        })
      }
    }

    return newJob
  })

  return Response.json(job, { status: 201 })
}
