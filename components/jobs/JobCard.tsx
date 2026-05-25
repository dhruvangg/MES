// components/jobs/JobCard.tsx
import Link from 'next/link'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobListItemDTO } from '@/types'

interface JobCardProps {
  job: JobListItemDTO
}

const priorityPill: Record<string, string> = {
  URGENT: 'pill-urgent',
  HIGH: 'pill-high',
  NORMAL: 'pill-normal',
  LOW: 'pill-low',
}

const delayPill: Record<string, string> = {
  overdue: 'pill-reject',
  'due-today': 'pill-warn',
  'due-tomorrow': 'pill-warn',
  'on-track': 'pill-pass',
  completed: 'pill-pass',
}

const delayLabel: Record<string, string> = {
  overdue: 'Overdue',
  'due-today': 'Today',
  'due-tomorrow': 'Tomorrow',
  'on-track': 'On track',
  completed: 'Done',
}

export default function JobCard({ job }: JobCardProps) {
  const hasWarning = job.delayStatus === 'overdue' || job.delayStatus === 'due-today'

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div
        className={cn(
          'bg-white border border-gray-200 rounded-xl p-4 transition-shadow hover:shadow-md active:scale-[0.99] touch-target',
          hasWarning && 'border-l-4 border-l-[#E84040]'
        )}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{job.jobNumber}</div>
            <div className="text-xs text-gray-500 truncate">{job.customerName}</div>
          </div>
          <span className={cn('pill-tag flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full', delayPill[job.delayStatus])}>
            {delayLabel[job.delayStatus]}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {job.activeOperation && (
            <span className="pill-active text-[11px] font-medium px-2 py-0.5 rounded-full">
              {job.activeOperation}
            </span>
          )}
          <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', priorityPill[job.priority])}>
            {job.priority}
          </span>
          {job.delayStatus === 'overdue' && (
            <span className="flex items-center gap-1 text-[11px] text-[#791F1F]">
              <Clock size={10} /> Overdue
            </span>
          )}
        </div>

        {/* Stage progress bar */}
        {job.stepsTotal > 0 && (
          <div className="flex gap-1 mt-2">
            {Array.from({ length: job.stepsTotal }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'stage-seg flex-1',
                  i < job.stepsDone ? 'stage-seg-done' :
                  i === job.stepsDone ? 'stage-seg-active' :
                  'stage-seg-idle'
                )}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">
            {job.stepsDone}/{job.stepsTotal} steps · {job.totalParts} {job.totalParts === 1 ? 'part' : 'parts'}
          </span>
          {job.poNumber && (
            <span className="text-[11px] text-gray-400">{job.poNumber}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
