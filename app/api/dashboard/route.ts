// app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getJobDelayStatus } from '@/lib/qty'

export async function GET() {
  await requireAuth()

  const [jobs, openDIs, steps] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: ['ACTIVE', 'DRAFT'] } },
      include: {
        jobParts: {
          include: {
            routingSteps: {
              include: { operation: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.discrepancyIssue.count({
      where: { disposition: 'UNDER_REVIEW' },
    }),
    prisma.routingStep.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { operation: { select: { name: true } } },
    }),
  ])

  const activeJobs = jobs.length
  const delayedJobs = jobs.filter(j => {
    const status = getJobDelayStatus(j.dueDate, j.status)
    return status === 'overdue' || status === 'due-today'
  }).length

  // Sum all rejections and reworks
  const allParts = jobs.flatMap(j => j.jobParts)
  const totalRejections = allParts.reduce((s, p) => s + p.rejectedQty, 0)
  const totalReworks = allParts.reduce((s, p) => s + p.reworkQty, 0)

  // Find bottleneck operation (most in-progress qty)
  const opQty: Record<string, { name: string; qty: number }> = {}
  for (const step of steps) {
    const pending = step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected
    const opId = step.operationId
    if (!opQty[opId]) opQty[opId] = { name: step.operation.name, qty: 0 }
    opQty[opId].qty += pending
  }

  const bottleneck = Object.values(opQty).sort((a, b) => b.qty - a.qty)[0] ?? null

  return Response.json({
    activeJobs,
    delayedJobs,
    totalRejections,
    totalReworks,
    openDIs,
    bottleneck: bottleneck ? { operationName: bottleneck.name, pendingQty: bottleneck.qty } : null,
  })
}
