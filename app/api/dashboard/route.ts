// app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getJobDelayStatus } from '@/lib/qty'

// ── Fetchers (types derived from these) ───────────────────────────────────────
async function fetchJobs() {
  return prisma.job.findMany({
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
  })
}

async function fetchSteps() {
  return prisma.routingStep.findMany({
    where: { status: 'IN_PROGRESS' },
    include: { operation: { select: { name: true } } },
  })
}

type JobRow  = Awaited<ReturnType<typeof fetchJobs>>[number]
type JobPart = JobRow['jobParts'][number]
type StepRow = Awaited<ReturnType<typeof fetchSteps>>[number]

export async function GET() {
  await requireAuth()

  const [jobs, openDIs, steps] = await Promise.all([
    fetchJobs(),
    prisma.discrepancyIssue.count({
      where: { disposition: 'UNDER_REVIEW' },
    }),
    fetchSteps(),
  ])

  const activeJobs = jobs.length
  const delayedJobs = jobs.filter((j: JobRow) => {
    const status = getJobDelayStatus(j.dueDate, j.status)
    return status === 'overdue' || status === 'due-today'
  }).length

  // Sum all rejections and reworks
  const allParts = jobs.flatMap((j: JobRow) => j.jobParts)
  const totalRejections = allParts.reduce((s: number, p: JobPart) => s + p.rejectedQty, 0)
  const totalReworks = allParts.reduce((s: number, p: JobPart) => s + p.reworkQty, 0)

  // Find bottleneck operation (most in-progress qty)
  const opQty: Record<string, { name: string; qty: number }> = {}
  for (const step of steps as StepRow[]) {
    const pending = step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected
    const opId = step.operationId
    if (!opQty[opId]) opQty[opId] = { name: step.operation.name, qty: 0 }
    opQty[opId].qty += pending
  }

  const bottleneck = Object.values(opQty).sort((a: { name: string; qty: number }, b: { name: string; qty: number }) => b.qty - a.qty)[0] ?? null

  return Response.json({
    activeJobs,
    delayedJobs,
    totalRejections,
    totalReworks,
    openDIs,
    bottleneck: bottleneck ? { operationName: bottleneck.name, pendingQty: bottleneck.qty } : null,
  })
}
