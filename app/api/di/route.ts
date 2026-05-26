// app/api/di/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

// ── Fetcher (type derived from this) ───────────────────────────────────────
async function fetchDIs(where: Parameters<typeof prisma.discrepancyIssue.findMany>[0]['where']) {
  return prisma.discrepancyIssue.findMany({
    where,
    include: {
      routingStep: { include: { operation: { select: { name: true } } } },
      reworkTargetStep: { include: { operation: { select: { name: true } } } },
      updatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

type DIRow = Awaited<ReturnType<typeof fetchDIs>>[number]

export async function GET(request: Request) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const jobPartId = searchParams.get('jobPartId')
  const routingStepId = searchParams.get('routingStepId')
  const disposition = searchParams.get('disposition')

  const dis = await fetchDIs({
    ...(jobPartId ? { jobPartId } : {}),
    ...(routingStepId ? { routingStepId } : {}),
    ...(disposition ? { disposition: disposition as any } : {}),
  })

  return Response.json(dis.map((d: DIRow) => ({
    id: d.id,
    jobPartId: d.jobPartId,
    routingStepId: d.routingStepId,
    operationName: d.routingStep.operation.name,
    reason: d.reason,
    description: d.description,
    qty: d.qty,
    disposition: d.disposition,
    isReworkable: d.isReworkable,
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedByName: d.updatedBy.name,
    reworkTargetStepId: d.reworkTargetStepId ?? null,
    reworkTargetStepName: d.reworkTargetStep
      ? `Step ${d.reworkTargetStep.sequence}: ${d.reworkTargetStep.operation.name}`
      : null,
  })))
}

export async function POST(request: Request) {
  const session = await requireAuth()
  const { jobPartId, routingStepId, reason, description, qty } = await request.json()

  if (!jobPartId || !routingStepId || !reason || !qty) {
    return Response.json({ error: 'jobPartId, routingStepId, reason, qty required' }, { status: 400 })
  }

  const step = await prisma.routingStep.findUnique({ where: { id: routingStepId } })
  if (!step) return Response.json({ error: 'Step not found' }, { status: 404 })

  const pending = step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected
  if (qty > pending) {
    return Response.json(
      { error: `Only ${pending} pcs pending. Cannot raise DI for ${qty}.` },
      { status: 400 }
    )
  }

  const di = await prisma.discrepancyIssue.create({
    data: { jobPartId, routingStepId, reason, description, qty, isReworkable: true, updatedById: session.id },
  })

  return Response.json(di, { status: 201 })
}

/**
 * PATCH /api/di
 *
 * Resolve a DI as REWORK or REJECTED.
 *
 * For REWORK: requires `reworkTargetStepId` — the step these parts are
 * re-injected into. That step's qtyIn is incremented and it re-opens if
 * it was COMPLETED. The original step's qtyRework increments and is
 * checked for completion.
 *
 * For REJECTED: increments qtyRejected on original step, increments
 * jobPart.rejectedQty, checks original step completion.
 */
export async function PATCH(request: Request) {
  const session = await requireAuth()
  const { id, disposition, reworkTargetStepId } = await request.json()

  if (!id || !disposition) return Response.json({ error: 'id and disposition required' }, { status: 400 })
  if (!['REWORK', 'REJECTED'].includes(disposition)) {
    return Response.json({ error: 'disposition must be REWORK or REJECTED' }, { status: 400 })
  }
  if (disposition === 'REWORK' && !reworkTargetStepId) {
    return Response.json({ error: 'reworkTargetStepId required for REWORK' }, { status: 400 })
  }

  const di = await prisma.discrepancyIssue.findUnique({
    where: { id },
    include: { routingStep: true },
  })
  if (!di) return Response.json({ error: 'DI not found' }, { status: 404 })
  if (di.disposition !== 'UNDER_REVIEW') return Response.json({ error: 'DI already resolved' }, { status: 400 })

  if (disposition === 'REWORK') {
    // Validate target step belongs to same job part
    const targetStep = await prisma.routingStep.findUnique({ where: { id: reworkTargetStepId } })
    if (!targetStep || targetStep.jobPartId !== di.jobPartId) {
      return Response.json({ error: 'Invalid rework target step' }, { status: 400 })
    }
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Resolve the DI
    await tx.discrepancyIssue.update({
      where: { id },
      data: {
        disposition,
        isReworkable: disposition === 'REWORK',
        reworkTargetStepId: disposition === 'REWORK' ? reworkTargetStepId : null,
        resolvedAt: new Date(),
        updatedById: session.id,
      },
    })

    if (disposition === 'REWORK') {
      // 2a. Log it on the ORIGINAL step
      await tx.routingStep.update({
        where: { id: di.routingStepId },
        data: { qtyRework: { increment: di.qty } },
      })
      await tx.jobPart.update({
        where: { id: di.jobPartId },
        data: { reworkQty: { increment: di.qty } },
      })
      await tx.productionLog.create({
        data: {
          jobPartId: di.jobPartId,
          routingStepId: di.routingStepId,
          action: 'REWORK',
          qty: di.qty,
          notes: `DI resolved → rework at Step ${reworkTargetStepId}. Reason: ${di.reason}`,
          updatedById: session.id,
        },
      })

      // 2b. Re-inject parts into the rework target step
      await tx.routingStep.update({
        where: { id: reworkTargetStepId },
        data: {
          status: 'IN_PROGRESS',
          qtyIn: { increment: di.qty },
          completedAt: null, // Re-open if it was completed
        },
      })
    }

    if (disposition === 'REJECTED') {
      await tx.routingStep.update({
        where: { id: di.routingStepId },
        data: { qtyRejected: { increment: di.qty } },
      })
      await tx.jobPart.update({
        where: { id: di.jobPartId },
        data: { rejectedQty: { increment: di.qty } },
      })
      await tx.productionLog.create({
        data: {
          jobPartId: di.jobPartId,
          routingStepId: di.routingStepId,
          action: 'REJECT',
          qty: di.qty,
          notes: `DI permanently rejected — ${di.reason}`,
          updatedById: session.id,
        },
      })
    }

    // 3. Check if original step is now fully dispositioned
    const refreshedStep = await tx.routingStep.findUnique({ where: { id: di.routingStepId } })
    if (refreshedStep && refreshedStep.status !== 'COMPLETED') {
      const nowPending = refreshedStep.qtyIn - refreshedStep.qtyPassed - refreshedStep.qtyRework - refreshedStep.qtyRejected
      if (nowPending <= 0) {
        await tx.routingStep.update({
          where: { id: di.routingStepId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        if (refreshedStep.qtyPassed > 0) {
          const nextStep = await tx.routingStep.findFirst({
            where: { jobPartId: di.jobPartId, sequence: refreshedStep.sequence + 1 },
          })
          if (nextStep) {
            if (nextStep.qtyIn > 0) {
              await tx.routingStep.update({
                where: { id: nextStep.id },
                data: { status: 'IN_PROGRESS', qtyIn: { increment: refreshedStep.qtyPassed }, completedAt: null },
              })
            } else {
              await tx.routingStep.update({
                where: { id: nextStep.id },
                data: { status: 'IN_PROGRESS', qtyIn: refreshedStep.qtyPassed, startedAt: new Date() },
              })
            }
          }
        }
      }
    }

    return { ok: true }
  })

  return Response.json(result)
}
