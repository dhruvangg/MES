// app/(dashboard)/jobs/[id]/report/page.tsx
// Detailed Job Process Report — server component
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getJobDelayStatus, stepPendingQty } from '@/lib/qty'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, AlertTriangle, Clock, Package, TrendingDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { diReasonLabel } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function getJobReport(id: string) {
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
              productionLogs: {
                include: { updatedBy: { select: { name: true } } },
                orderBy: { createdAt: 'asc' },
              },
              discrepancyIssues: {
                include: { updatedBy: { select: { name: true } } },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
  })
  if (!job) notFound()
  return job
}

const actionColors: Record<string, { bg: string; text: string; label: string }> = {
  PASS: { bg: '#EAF3DE', text: '#27500A', label: 'Passed' },
  REWORK: { bg: '#EEEDFE', text: '#3C3489', label: 'Rework' },
  REJECT: { bg: '#FCEBEB', text: '#791F1F', label: 'Rejected' },
}

const dispColors: Record<string, { bg: string; text: string }> = {
  UNDER_REVIEW: { bg: '#FAEEDA', text: '#633806' },
  REWORK: { bg: '#EEEDFE', text: '#3C3489' },
  REJECTED: { bg: '#FCEBEB', text: '#791F1F' },
  ACCEPTED_AS_IS: { bg: '#EAF3DE', text: '#27500A' },
}

// ── Derived types from Prisma query ──────────────────────────────────────────
type JobReport   = NonNullable<Awaited<ReturnType<typeof getJobReport>>>
type JobPart     = JobReport['jobParts'][number]
type RoutingStep = JobPart['routingSteps'][number]
type Log         = RoutingStep['productionLogs'][number]
type DI          = RoutingStep['discrepancyIssues'][number]

export default async function JobReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJobReport(id)
  const delay = getJobDelayStatus(job.dueDate, job.status)

  const allSteps: RoutingStep[] = job.jobParts.flatMap((p: JobPart) => p.routingSteps)
  const totalDIs = allSteps.reduce((s: number, step) => s + step.discrepancyIssues.length, 0)
  const openDIs = allSteps.reduce((s: number, step) => s + step.discrepancyIssues.filter((d: DI) => d.disposition === 'UNDER_REVIEW').length, 0)
  const totalLogs = allSteps.reduce((s: number, step) => s + step.productionLogs.length, 0)
  const stepsComplete = allSteps.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/jobs/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={16} /> Back to job
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700">Process Report</span>
      </div>

      {/* Job header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 print:shadow-none">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{job.jobNumber}</h1>
            <p className="text-sm text-gray-500">{job.customer.name}</p>
          </div>
          <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full',
            delay === 'overdue' ? 'pill-reject' :
            delay === 'due-today' ? 'pill-warn' :
            job.status === 'COMPLETED' ? 'pill-pass' : 'pill-active'
          )}>
            {job.status === 'COMPLETED' ? 'Completed' :
             delay === 'overdue' ? 'Overdue' :
             delay === 'due-today' ? 'Due today' : 'In progress'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm mb-3">
          {[
            { label: 'PO', value: job.poNumber ?? '—' },
            { label: 'Due date', value: formatDate(job.dueDate) },
            { label: 'Priority', value: job.priority },
            { label: 'Parts', value: job.jobParts.length },
            { label: 'Stages', value: `${stepsComplete}/${allSteps.length} done` },
            { label: 'Generated', value: formatDate(new Date()) },
          ].map(f => (
            <div key={f.label}>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">{f.label}</span>
              <p className="text-sm font-medium text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
        {job.notes && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{job.notes}</p>}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total DIs', value: totalDIs, icon: AlertTriangle, color: '#633806', bg: '#FAEEDA' },
          { label: 'Open DIs', value: openDIs, icon: AlertTriangle, color: '#791F1F', bg: '#FCEBEB' },
          { label: 'Production logs', value: totalLogs, icon: Clock, color: '#0C447C', bg: '#E6F1FB' },
          { label: 'Stages done', value: `${stepsComplete}/${allSteps.length}`, icon: CheckCircle2, color: '#27500A', bg: '#EAF3DE' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</span>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={12} style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Per-part report */}
      {job.jobParts.map((jp: JobPart) => {
        const totalRejected = jp.routingSteps.reduce((s, st) => s + st.qtyRejected, 0)
        const totalRework = jp.routingSteps.reduce((s, st) => s + st.qtyRework, 0)
        const yieldPct = jp.totalQty > 0
          ? Math.round(((jp.totalQty - totalRejected) / jp.totalQty) * 100)
          : 100

        return (
          <div key={jp.id} className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
            {/* Part header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    {jp.part.name}
                  </div>
                  {jp.drawing && <div className="text-xs text-gray-400 mt-0.5">Drawing: {jp.drawing.number}{jp.drawing.revision ? ` Rev ${jp.drawing.revision}` : ''}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900">{yieldPct}%</div>
                  <div className="text-[10px] text-gray-400">yield</div>
                </div>
              </div>
              {/* Qty summary row */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Ordered', value: jp.totalQty, color: '#0C447C', bg: '#E6F1FB' },
                  { label: 'Completed', value: jp.completedQty, color: '#27500A', bg: '#EAF3DE' },
                  { label: 'Rejected', value: totalRejected, color: '#791F1F', bg: '#FCEBEB' },
                  { label: 'Rework', value: totalRework, color: '#3C3489', bg: '#EEEDFE' },
                ].map(q => (
                  <div key={q.label} className="text-center rounded-lg py-1.5" style={{ background: q.bg }}>
                    <div className="text-sm font-bold" style={{ color: q.color }}>{q.value}</div>
                    <div className="text-[9px]" style={{ color: q.color }}>{q.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage-by-stage breakdown */}
            <div className="divide-y divide-gray-100">
              {jp.routingSteps.map((step: RoutingStep) => {
                const pending = stepPendingQty(step)
                const stageDIs = step.discrepancyIssues
                const stageLogs = step.productionLogs

                return (
                  <div key={step.id} className={cn('px-4 py-3',
                    step.status === 'IN_PROGRESS' && 'bg-[#E6F1FB]/20',
                    step.status === 'PENDING' && 'opacity-60'
                  )}>
                    {/* Step header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                        step.status === 'COMPLETED' ? 'bg-[#EAF3DE] text-[#27500A]' :
                        step.status === 'IN_PROGRESS' ? 'bg-[#E6F1FB] text-[#0C447C]' :
                        'bg-gray-100 text-gray-400'
                      )}>
                        {step.sequence}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">{step.operation.name}</span>
                        <span className={cn('ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          step.status === 'COMPLETED' ? 'bg-[#EAF3DE] text-[#27500A]' :
                          step.status === 'IN_PROGRESS' ? 'bg-[#E6F1FB] text-[#0C447C]' :
                          'bg-gray-100 text-gray-400'
                        )}>
                          {step.status.replace('_', ' ')}
                        </span>
                      </div>
                      {step.status !== 'PENDING' && (
                        <div className="text-xs text-gray-400 flex-shrink-0">
                          {step.startedAt ? formatDate(step.startedAt) : ''}
                          {step.completedAt ? ` → ${formatDate(step.completedAt)}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Qty bars */}
                    {step.qtyIn > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {[
                          { label: 'In', val: step.qtyIn, c: '#0C447C', bg: '#E6F1FB' },
                          { label: 'Pass', val: step.qtyPassed, c: '#27500A', bg: '#EAF3DE' },
                          { label: 'Rework', val: step.qtyRework, c: '#3C3489', bg: '#EEEDFE' },
                          { label: 'Reject', val: step.qtyRejected, c: '#791F1F', bg: '#FCEBEB' },
                          ...(pending > 0 ? [{ label: 'Pending', val: pending, c: '#5F5E5A', bg: '#F1EFE8' }] : []),
                        ].filter(q => q.val > 0).map(q => (
                          <span key={q.label} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: q.bg, color: q.c }}>
                            {q.label}: {q.val}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Production logs */}
                    {stageLogs.length > 0 && (
                      <div className="mt-2 mb-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Activity log</div>
                        <div className="space-y-1">
                          {stageLogs.map((log: Log) => {
                            const ac = actionColors[log.action] ?? { bg: '#F1EFE8', text: '#5F5E5A', label: log.action }
                            return (
                              <div key={log.id} className="flex items-center gap-2 text-xs">
                                <span className="font-medium px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: ac.bg, color: ac.text }}>
                                  {ac.label}
                                </span>
                                <span className="font-semibold text-gray-700">{log.qty} pcs</span>
                                <span className="text-gray-400">by {log.updatedBy.name}</span>
                                <span className="text-gray-300 ml-auto">{formatDate(log.createdAt)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* DIs */}
                    {stageDIs.length > 0 && (
                      <div className="mt-2 border border-[#EF9F27]/30 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-[#FAEEDA]/60 text-[10px] font-semibold text-[#633806] uppercase tracking-widest">
                          Discrepancy Issues ({stageDIs.length})
                        </div>
                        <div className="divide-y divide-[#EF9F27]/20">
                          {stageDIs.map((di: DI) => {
                            const dc = dispColors[di.disposition] ?? { bg: '#F1EFE8', text: '#5F5E5A' }
                            return (
                              <div key={di.id} className="px-3 py-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-[#633806]">{diReasonLabel(di.reason)}</span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#FAEEDA] text-[#633806]">{di.qty} pcs</span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: dc.bg, color: dc.text }}>
                                      {di.disposition.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">{di.updatedBy.name}</span>
                                </div>
                                {di.description && (
                                  <p className="text-xs text-gray-500 mt-1">{di.description}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {step.status === 'PENDING' && step.qtyIn === 0 && (
                      <p className="text-xs text-gray-400 italic">Not started yet</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-2">
        Report generated {new Date().toLocaleString('en-IN')} · MES Production Tracker
      </p>
    </div>
  )
}
