// app/api/jobs/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getJobDelayStatus } from '@/lib/qty'
import { generateJobNumber } from '@/lib/utils'
import type { CreateJobRequest } from '@/types'
import { type Prisma } from '@prisma/client'

// ── Fetcher (types derived from these) ──────────────────────────────────────
async function fetchJobs(where: Prisma.JobWhereInput) {
  return prisma.job.findMany({
    where,
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
}

type JobRow      = Awaited<ReturnType<typeof fetchJobs>>[number]
type JobPart     = JobRow['jobParts'][number]
type RoutingStep = JobPart['routingSteps'][number]

export async function GET(request: Request) {
  try {
    await requireAuth()
  } catch {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const customerId = searchParams.get('customerId')

    const jobs = await fetchJobs({
      ...(status ? { status: status as any } : {}),
      ...(priority ? { priority: priority as any } : {}),
      ...(customerId ? { customerId } : {}),
    })

    const result = jobs.map((job: JobRow) => {
      const allSteps = job.jobParts.flatMap((p: JobPart) => p.routingSteps)
      const activeStep = allSteps.find((s: RoutingStep) => s.status === 'IN_PROGRESS')
      const stepsTotal = allSteps.length
      const stepsDone = allSteps.filter((s: RoutingStep) => s.status === 'COMPLETED').length

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/jobs]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const body: CreateJobRequest = await request.json()
    const { customerId, poNumber, dueDate, priority, notes, parts } = body

    if (!customerId || !parts?.length) {
      return Response.json({ error: 'Customer and at least one part required' }, { status: 400 })
    }

    // Create job first, then parts and steps sequentially
    // Using individual creates instead of interactive $transaction
    // because Prisma driver adapters have unreliable interactive transaction support
    const newJob = await prisma.job.create({
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

    try {
      for (const part of parts) {
        const jobPart = await prisma.jobPart.create({
          data: {
            jobId: newJob.id,
            partId: part.partId,
            drawingId: part.drawingId ?? null,
            totalQty: part.totalQty,
          },
        })

        // Create routing steps in sequence order
        const sortedRouting = [...part.routing].sort((a, b) => a.sequence - b.sequence)
        for (let i = 0; i < sortedRouting.length; i++) {
          const step = sortedRouting[i]
          await prisma.routingStep.create({
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
    } catch (innerErr: unknown) {
      // Clean up the job if part/step creation fails (manual rollback)
      await prisma.job.delete({ where: { id: newJob.id } }).catch(() => {})
      throw innerErr
    }

    return Response.json(newJob, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/jobs]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
