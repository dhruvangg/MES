import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getJobDelayStatus, stepPendingQty } from '@/lib/qty'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JobActions } from './_components/JobActions'

export const dynamic = 'force-dynamic'

async function getJob(id: string) {
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
              discrepancyIssues: { select: { id: true, disposition: true } },
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

const statusIcon = {
  COMPLETED: <CheckCircle2 size={18} className="text-[#27500A]" />,
  IN_PROGRESS: <PlayCircle size={18} className="text-[#0C447C]" />,
  PENDING: <Circle size={18} className="text-gray-300" />,
  ON_HOLD: <AlertTriangle size={18} className="text-[#633806]" />,
}

const statusBg: Record<string, string> = {
  COMPLETED: 'bg-[#EAF3DE]',
  IN_PROGRESS: 'bg-[#E6F1FB]',
  PENDING: 'bg-[#F1EFE8]',
  ON_HOLD: 'bg-[#FAEEDA]',
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  const delayStatus = getJobDelayStatus(job.dueDate, job.status)

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      {/* Top nav row — back + actions */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={16} /> Job board
        </Link>
        <JobActions jobId={id} isCompleted={job.status === 'COMPLETED'} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{job.jobNumber}</h2>
            <p className="text-sm text-gray-500">{job.customer.name}</p>
          </div>
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0',
            delayStatus === 'overdue' ? 'pill-reject' :
            delayStatus === 'due-today' ? 'pill-warn' :
            delayStatus === 'completed' ? 'pill-pass' : 'pill-active'
          )}>
            {delayStatus === 'overdue' ? 'Overdue' : delayStatus === 'due-today' ? 'Due today' : delayStatus === 'completed' ? 'Completed' : 'On track'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
          <div><span className="text-gray-400 text-xs">PO</span><p className="text-gray-800 font-medium">{job.poNumber ?? '—'}</p></div>
          <div><span className="text-gray-400 text-xs">Due date</span><p className={cn('font-medium', delayStatus === 'overdue' ? 'text-[#791F1F]' : 'text-gray-800')}>{formatDate(job.dueDate)}</p></div>
        </div>
        {job.notes && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{job.notes}</p>}
      </div>

      {job.jobParts.map(jp => (
        <div key={jp.id} className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">{jp.part.name}</div>
                {jp.drawing && <div className="text-xs text-gray-400">Dwg: {jp.drawing.number}</div>}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">{jp.totalQty}</div>
                <div className="text-[10px] text-gray-400">Total qty</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Done', value: jp.completedQty, color: '#27500A', bg: '#EAF3DE' },
                { label: 'Reject', value: jp.rejectedQty, color: '#791F1F', bg: '#FCEBEB' },
                { label: 'Rework', value: jp.reworkQty, color: '#3C3489', bg: '#EEEDFE' },
                { label: 'Pending', value: jp.totalQty - jp.completedQty - jp.rejectedQty, color: '#5F5E5A', bg: '#F1EFE8' },
              ].map(q => (
                <div key={q.label} className="text-center rounded-lg py-1.5" style={{ background: q.bg }}>
                  <div className="text-base font-semibold" style={{ color: q.color }}>{q.value}</div>
                  <div className="text-[9px]" style={{ color: q.color }}>{q.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {jp.routingSteps.map(step => {
              const pending = stepPendingQty(step)
              const openDIs = step.discrepancyIssues.filter(d => d.disposition === 'UNDER_REVIEW').length
              // Steps are navigable if active/completed OR if they have open DIs needing resolution
              const canNavigate = step.status !== 'PENDING' || openDIs > 0
              const inner = (
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  canNavigate && 'hover:bg-gray-50',
                  step.status === 'IN_PROGRESS' && 'bg-[#E6F1FB]/30',
                  openDIs > 0 && step.status === 'PENDING' && 'bg-[#FAEEDA]/20'
                )}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusBg[step.status])}>
                    {statusIcon[step.status as keyof typeof statusIcon]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-medium', step.status === 'IN_PROGRESS' ? 'text-[#0C447C]' : 'text-gray-800')}>
                      {step.operation.name}
                      {step.status === 'IN_PROGRESS' && <span className="text-xs font-normal ml-1">(active)</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {step.status === 'COMPLETED' ? `Done · ${step.qtyPassed} passed` :
                       step.status === 'IN_PROGRESS' ? `In: ${step.qtyIn} · ${pending} remaining` : 'Pending'}
                    </div>
                  </div>
                  {openDIs > 0 && (
                    <span className="inline-flex items-center gap-1 pill-warn text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 border border-[#EF9F27]">
                      <AlertTriangle size={11} />
                      {openDIs} open DI
                    </span>
                  )}
                  {canNavigate && <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                </div>
              )
              return canNavigate ? (
                <Link key={step.id} href={`/jobs/${id}/parts/${jp.id}/steps/${step.id}`}>{inner}</Link>
              ) : (
                <div key={step.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
