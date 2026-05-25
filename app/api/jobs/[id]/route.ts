// app/api/jobs/[id]/route.ts — GET job detail + PATCH update + DELETE job
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getJobDelayStatus, stepPendingQty } from '@/lib/qty'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAuth()
  const { id } = await ctx.params

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      jobParts: {
        include: {
          part: true,
          drawing: true,
          routingSteps: {
            include: {
              operation: true,
              updatedBy: { select: { name: true } },
              discrepancyIssues: true,
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
  })

  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  const allSteps = job.jobParts.flatMap(p => p.routingSteps)
  const activeStep = allSteps.find(s => s.status === 'IN_PROGRESS')

  const result = {
    id: job.id,
    jobNumber: job.jobNumber,
    customerName: job.customer.name,
    customerId: job.customerId,
    poNumber: job.poNumber,
    dueDate: job.dueDate?.toISOString() ?? null,
    priority: job.priority,
    status: job.status,
    notes: job.notes,
    delayStatus: getJobDelayStatus(job.dueDate, job.status),
    totalParts: job.jobParts.length,
    activeOperation: activeStep?.operation.name ?? null,
    stepsTotal: allSteps.length,
    stepsDone: allSteps.filter(s => s.status === 'COMPLETED').length,
    jobParts: job.jobParts.map(jp => ({
      id: jp.id,
      partId: jp.partId,
      partName: jp.part.name,
      drawingNumber: jp.drawing?.number ?? null,
      totalQty: jp.totalQty,
      completedQty: jp.completedQty,
      rejectedQty: jp.rejectedQty,
      reworkQty: jp.reworkQty,
      pendingQty: jp.totalQty - jp.completedQty - jp.rejectedQty,
      routingSteps: jp.routingSteps.map(s => ({
        id: s.id,
        operationId: s.operationId,
        operationName: s.operation.name,
        sequence: s.sequence,
        status: s.status,
        qtyIn: s.qtyIn,
        qtyPassed: s.qtyPassed,
        qtyRework: s.qtyRework,
        qtyRejected: s.qtyRejected,
        qtyPending: stepPendingQty(s),
        startedAt: s.startedAt?.toISOString() ?? null,
        completedAt: s.completedAt?.toISOString() ?? null,
        updatedById: s.updatedById,
        updatedByName: s.updatedBy?.name ?? null,
        diCount: s.discrepancyIssues.length,
      })),
    })),
  }

  return Response.json(result)
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAuth()
  const { id } = await ctx.params
  const data = await request.json()

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    },
  })

  return Response.json(job)
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAuth()
  const { id } = await ctx.params

  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  if (job.status === 'COMPLETED') {
    return Response.json({ error: 'Completed jobs cannot be deleted' }, { status: 400 })
  }

  // Cascade delete via Prisma schema (JobPart → RoutingStep → ProductionLog/DI all cascade)
  await prisma.job.delete({ where: { id } })

  return Response.json({ ok: true })
}
