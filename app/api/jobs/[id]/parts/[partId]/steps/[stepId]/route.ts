// app/api/jobs/[id]/parts/[partId]/steps/[stepId]/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { stepPendingQty, validateStepUpdate } from '@/lib/qty'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

// ── Fetchers (types derived from these) ────────────────────────────────────
async function fetchStep(stepId: string) {
  return prisma.routingStep.findUnique({
    where: { id: stepId },
    include: {
      operation: true,
      jobPart: {
        include: {
          part: true,
          drawing: true,
          job: { include: { customer: { select: { name: true } } } },
          routingSteps: { include: { operation: true }, orderBy: { sequence: 'asc' } },
        },
      },
    },
  })
}

type StepWithRelations = NonNullable<Awaited<ReturnType<typeof fetchStep>>>
type SiblingStepRow    = StepWithRelations['jobPart']['routingSteps'][number]

async function fetchAllParts(jobId: string) {
  return prisma.jobPart.findMany({
    where: { jobId },
    include: { routingSteps: { orderBy: { sequence: 'desc' }, take: 1 } },
  })
}

type AllPartRow = Awaited<ReturnType<typeof fetchAllParts>>[number]

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; partId: string; stepId: string }> }
) {
  await requireAuth()
  const { partId, stepId } = await ctx.params

  const step = await fetchStep(stepId)

  if (!step || step.jobPartId !== partId) {
    return Response.json({ error: 'Step not found' }, { status: 404 })
  }

  return Response.json({
    id: step.id,
    operationName: step.operation.name,
    status: step.status,
    qtyIn: step.qtyIn,
    qtyPassed: step.qtyPassed,
    qtyRework: step.qtyRework,
    qtyRejected: step.qtyRejected,
    qtyPending: stepPendingQty(step),
    jobPart: {
      partName: step.jobPart.part.name,
      drawingNumber: step.jobPart.drawing?.number ?? null,
      totalQty: step.jobPart.totalQty,
    },
    job: {
      jobNumber: step.jobPart.job.jobNumber,
      customerName: step.jobPart.job.customer.name,
    },
    // All sibling steps — used to build the rework re-entry picker
    siblingSteps: step.jobPart.routingSteps.map((s: SiblingStepRow) => ({
      id: s.id,
      sequence: s.sequence,
      operationName: s.operation.name,
      status: s.status,
    })),
  })
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; partId: string; stepId: string }> }
) {
  const session = await requireAuth()
  const { id: jobId, partId, stepId } = await ctx.params
  const { action, qty, notes } = await request.json()

  if (!action || !qty) return Response.json({ error: 'action and qty required' }, { status: 400 })
  if (!['PASS', 'REJECT'].includes(action)) {
    return Response.json({ error: 'action must be PASS or REJECT' }, { status: 400 })
  }

  const step = await prisma.routingStep.findUnique({ where: { id: stepId }, include: { jobPart: true } })
  if (!step || step.jobPartId !== partId) return Response.json({ error: 'Step not found' }, { status: 404 })
  if (step.status === 'COMPLETED') return Response.json({ error: 'Step already completed' }, { status: 400 })

  const { valid, available } = validateStepUpdate(step, qty)
  if (!valid) return Response.json({ error: `Only ${available} pcs available` }, { status: 400 })

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newPassed   = action === 'PASS'   ? step.qtyPassed   + qty : step.qtyPassed
    const newRejected = action === 'REJECT' ? step.qtyRejected + qty : step.qtyRejected
    const newPending  = step.qtyIn - newPassed - step.qtyRework - newRejected
    const isNowDone   = newPending <= 0

    const updatedStep = await tx.routingStep.update({
      where: { id: stepId },
      data: {
        qtyPassed: newPassed,
        qtyRejected: newRejected,
        status: isNowDone ? 'COMPLETED' : 'IN_PROGRESS',
        startedAt: step.startedAt ?? new Date(),
        completedAt: isNowDone ? new Date() : undefined,
        updatedById: session.id,
      },
    })

    await tx.productionLog.create({
      data: { jobPartId: partId, routingStepId: stepId, action, qty, notes, updatedById: session.id },
    })

    if (action === 'REJECT') {
      await tx.jobPart.update({ where: { id: partId }, data: { rejectedQty: { increment: qty } } })
    }

    if (isNowDone && newPassed > 0) {
      const nextStep = await tx.routingStep.findFirst({
        where: { jobPartId: partId, sequence: step.sequence + 1 },
      })
      if (nextStep) {
        // Use increment if step already has data (rework re-entry scenario)
        if (nextStep.qtyIn > 0) {
          await tx.routingStep.update({
            where: { id: nextStep.id },
            data: { status: 'IN_PROGRESS', qtyIn: { increment: newPassed }, completedAt: null },
          })
        } else {
          await tx.routingStep.update({
            where: { id: nextStep.id },
            data: { status: 'IN_PROGRESS', qtyIn: newPassed, startedAt: new Date() },
          })
        }
      } else {
        // Last step — mark job part complete and check if whole job is done
        await tx.jobPart.update({ where: { id: partId }, data: { completedQty: { increment: newPassed } } })
        const allParts = await tx.jobPart.findMany({
          where: { jobId },
          include: { routingSteps: { orderBy: { sequence: 'desc' }, take: 1 } },
        })
        const allDone = allParts.every((p: AllPartRow) => p.routingSteps[0]?.status === 'COMPLETED')
        if (allDone) await tx.job.update({ where: { id: jobId }, data: { status: 'COMPLETED' } })
      }
    }

    return updatedStep
  })

  return Response.json(result)
}
