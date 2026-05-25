// app/(dashboard)/jobs/page.tsx
import { prisma } from '@/lib/prisma'
import { getJobDelayStatus } from '@/lib/qty'
import JobCard from '@/components/jobs/JobCard'
import Link from 'next/link'
import { Plus, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { JobListItemDTO } from '@/types'

export const dynamic = 'force-dynamic'

// ── Raw DB fetchers (types derived from these) ────────────────────────────────

async function fetchActiveJobs() {
  return prisma.job.findMany({
    where: { status: { in: ['ACTIVE', 'DRAFT'] } },
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
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })
}

async function fetchHistoryJobs() {
  return prisma.job.findMany({
    where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
    include: {
      customer: { select: { name: true } },
      jobParts: {
        include: {
          routingSteps: { select: { status: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

// ── Derived types (always accurate — sourced from actual query shape) ─────────
type ActiveJobRow  = Awaited<ReturnType<typeof fetchActiveJobs>>[number]
type ActiveJobPart = ActiveJobRow['jobParts'][number]
type HistoryJobRow = Awaited<ReturnType<typeof fetchHistoryJobs>>[number]

// ── Data mappers ──────────────────────────────────────────────────────────────

async function getActiveJobs(): Promise<JobListItemDTO[]> {
  const jobs = await fetchActiveJobs()

  return jobs.map((job: ActiveJobRow) => {
    const allSteps = job.jobParts.flatMap((p: ActiveJobPart) => p.routingSteps)
    const activeStep = allSteps.find(s => s.status === 'IN_PROGRESS')
    return {
      id: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customer.name,
      poNumber: job.poNumber,
      dueDate: job.dueDate?.toISOString() ?? null,
      priority: job.priority as any,
      status: job.status as any,
      delayStatus: getJobDelayStatus(job.dueDate, job.status),
      totalParts: job.jobParts.length,
      activeOperation: activeStep?.operation.name ?? null,
      stepsTotal: allSteps.length,
      stepsDone: allSteps.filter(s => s.status === 'COMPLETED').length,
    }
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const isHistory = view === 'history'

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-3xl mx-auto">
      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-4 bg-white border border-gray-200 rounded-xl p-1">
        <Link
          href="/jobs"
          className={`flex-1 text-center text-sm font-medium py-2 rounded-lg transition-colors ${
            !isHistory
              ? 'bg-[#185FA5] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Active orders
        </Link>
        <Link
          href="/jobs?view=history"
          className={`flex-1 text-center text-sm font-medium py-2 rounded-lg transition-colors ${
            isHistory
              ? 'bg-[#185FA5] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          History
        </Link>
      </div>

      {isHistory ? <HistoryView /> : <ActiveView />}

      {!isHistory && (
        <Link
          href="/jobs/new"
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 btn-primary rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <Plus size={18} />
          New order
        </Link>
      )}
    </div>
  )
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

async function ActiveView() {
  const jobs = await getActiveJobs()

  const overdue    = jobs.filter((j: JobListItemDTO) => j.delayStatus === 'overdue')
  const dueSoon    = jobs.filter((j: JobListItemDTO) => j.delayStatus === 'due-today' || j.delayStatus === 'due-tomorrow')
  const inProgress = jobs.filter((j: JobListItemDTO) => j.delayStatus === 'on-track')

  const stats = [
    { label: 'Active',   value: jobs.length,     color: 'text-gray-900' },
    { label: 'Due soon', value: dueSoon.length,   color: 'text-[#633806]' },
    { label: 'Overdue',  value: overdue.length,   color: 'text-[#791F1F]' },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Overdue</div>
          <div className="space-y-2">{overdue.map((job: JobListItemDTO) => <JobCard key={job.id} job={job} />)}</div>
        </section>
      )}

      {dueSoon.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Due today / tomorrow</div>
          <div className="space-y-2">{dueSoon.map((job: JobListItemDTO) => <JobCard key={job.id} job={job} />)}</div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">In progress</div>
          <div className="space-y-2">{inProgress.map((job: JobListItemDTO) => <JobCard key={job.id} job={job} />)}</div>
        </section>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base mb-1">No active jobs</p>
          <p className="text-sm">Create a new order to get started</p>
        </div>
      )}
    </>
  )
}

async function HistoryView() {
  const jobs = await fetchHistoryJobs()

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CheckCircle2 size={40} className="mx-auto mb-3 text-gray-200" />
        <p className="text-base mb-1">No completed orders yet</p>
        <p className="text-sm">Finished jobs will appear here</p>
      </div>
    )
  }

  const completed = jobs.filter((j: HistoryJobRow) => j.status === 'COMPLETED')
  const cancelled = jobs.filter((j: HistoryJobRow) => j.status === 'CANCELLED')

  return (
    <>
      {completed.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
            Completed · {completed.length}
          </div>
          <div className="space-y-2">
            {completed.map((job: HistoryJobRow) => {
              const allSteps = job.jobParts.flatMap(p => p.routingSteps)
              return (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow active:scale-[0.99]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{job.jobNumber}</div>
                        <div className="text-xs text-gray-500 truncate">{job.customer.name}</div>
                      </div>
                      <span className="pill-pass text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Done
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-gray-400">
                        {allSteps.length} steps · {job.jobParts.length} {job.jobParts.length === 1 ? 'part' : 'parts'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {job.poNumber ? `${job.poNumber} · ` : ''}{formatDate(job.dueDate)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {cancelled.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
            Cancelled · {cancelled.length}
          </div>
          <div className="space-y-2">
            {cancelled.map((job: HistoryJobRow) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block">
                <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow active:scale-[0.99] opacity-70">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-600 truncate line-through">{job.jobNumber}</div>
                      <div className="text-xs text-gray-400 truncate">{job.customer.name}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-400">
                      Cancelled
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-gray-400">
                      {job.jobParts.length} {job.jobParts.length === 1 ? 'part' : 'parts'}
                    </span>
                    {job.poNumber && (
                      <span className="text-[11px] text-gray-400">{job.poNumber}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
