// app/(dashboard)/page.tsx — Dashboard
import { prisma } from '@/lib/prisma'
import { getJobDelayStatus } from '@/lib/qty'
import { LayoutDashboard, AlertTriangle, CheckCircle, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getDashboardStats() {
  const [jobs, openDIs, steps] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: ['ACTIVE', 'DRAFT'] } },
      include: { jobParts: true },
    }),
    prisma.discrepancyIssue.count({ where: { disposition: 'UNDER_REVIEW' } }),
    prisma.routingStep.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { operation: { select: { name: true } } },
    }),
  ])

  const activeJobs = jobs.length
  const delayedJobs = jobs.filter(j => {
    const s = getJobDelayStatus(j.dueDate, j.status)
    return s === 'overdue' || s === 'due-today'
  }).length

  const allParts = jobs.flatMap(j => j.jobParts)
  const totalRejections = allParts.reduce((s, p) => s + p.rejectedQty, 0)
  const totalReworks = allParts.reduce((s, p) => s + p.reworkQty, 0)

  const opQty: Record<string, { name: string; qty: number }> = {}
  for (const step of steps) {
    const pending = Math.max(0, step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected)
    if (!opQty[step.operationId]) opQty[step.operationId] = { name: step.operation.name, qty: 0 }
    opQty[step.operationId].qty += pending
  }
  const bottleneck = Object.values(opQty).sort((a, b) => b.qty - a.qty)[0] ?? null

  return { activeJobs, delayedJobs, totalRejections, totalReworks, openDIs, bottleneck }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const cards = [
    { label: 'Active jobs', value: stats.activeJobs, icon: LayoutDashboard, color: '#185FA5', bg: '#E6F1FB' },
    { label: 'Delayed', value: stats.delayedJobs, icon: AlertTriangle, color: '#633806', bg: '#FAEEDA' },
    { label: 'Open DIs', value: stats.openDIs, icon: AlertCircle, color: '#791F1F', bg: '#FCEBEB' },
    { label: 'Total rejections', value: stats.totalRejections, icon: CheckCircle, color: '#791F1F', bg: '#FCEBEB' },
    { label: 'Reworks', value: stats.totalReworks, icon: RefreshCw, color: '#3C3489', bg: '#EEEDFE' },
  ]

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-500">{card.label}</div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {stats.bottleneck && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-[#633806]" />
            <div className="text-sm font-semibold text-gray-900">Bottleneck operation</div>
          </div>
          <div className="flex items-center justify-between">
            <span className="pill-warn text-sm font-semibold px-3 py-1.5 rounded-full">
              {stats.bottleneck.operationName}
            </span>
            <span className="text-2xl font-bold text-[#633806]">{stats.bottleneck.pendingQty} <span className="text-sm font-normal text-gray-400">pcs pending</span></span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Quick links</div>
        <div className="space-y-2">
          {[
            { href: '/jobs', label: 'View all active jobs', desc: `${stats.activeJobs} jobs in progress` },
            { href: '/jobs/new', label: 'Create new order', desc: 'Start a new production job' },
            { href: '/customers', label: 'Manage customers', desc: 'Add or edit customer records' },
            { href: '/operations', label: 'Manage operations', desc: 'Configure production operations' },
          ].map(link => (
            <a key={link.href} href={link.href} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-[#185FA5] transition-colors">{link.label}</div>
                <div className="text-xs text-gray-400">{link.desc}</div>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-[#185FA5] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
