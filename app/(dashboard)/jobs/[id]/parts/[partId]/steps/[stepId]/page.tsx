'use client'
// app/(dashboard)/jobs/[id]/parts/[partId]/steps/[stepId]/page.tsx
// CORE OPERATOR SCREEN
// Flow:
//   Active step → Pass | Raise DI | Reject
//   Open DIs section → per-DI: Rework | Permanently Reject
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, AlertTriangle, X, RefreshCw, ChevronDown, ChevronUp, Circle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { diReasonLabel } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type SiblingStep = { id: string; sequence: number; operationName: string; status: string }

type StepData = {
  id: string
  operationName: string
  status: string
  qtyIn: number
  qtyPassed: number
  qtyRework: number
  qtyRejected: number
  qtyPending: number
  jobPart: { partName: string; drawingNumber: string | null; totalQty: number }
  job: { jobNumber: string; customerName: string }
  siblingSteps: SiblingStep[]
}

type DI = {
  id: string
  reason: string
  description: string | null
  qty: number
  disposition: string
  isReworkable: boolean
  createdAt: string
  updatedByName: string
  reworkTargetStepId: string | null
  reworkTargetStepName: string | null
}

const DI_REASONS = [
  'DIMENSION_ISSUE', 'SURFACE_FINISH', 'CRACK',
  'MACHINE_ISSUE', 'WRONG_SETUP', 'MATERIAL_DEFECT', 'OTHER',
]

type Panel = null | 'pass' | 'reject' | 'di'

// ── Component ─────────────────────────────────────────────────────────────

export default function StageExecutionPage() {
  const params = useParams<{ id: string; partId: string; stepId: string }>()
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<StepData | null>(null)
  const [openDIs, setOpenDIs] = useState<DI[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>(null)
  const [qty, setQty] = useState('')
  const [diReason, setDiReason] = useState('DIMENSION_ISSUE')
  const [diDesc, setDiDesc] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'warn'>('success')
  const [error, setError] = useState('')
  const [diSectionOpen, setDiSectionOpen] = useState(true)
  const [resolvingDiId, setResolvingDiId] = useState<string | null>(null)

  // ── Data fetchers ────────────────────────────────────────────────────────

  const fetchStep = useCallback(async () => {
    const res = await fetch(`/api/jobs/${params.id}/parts/${params.partId}/steps/${params.stepId}`)
    if (res.ok) setStep(await res.json())
  }, [params])

  const fetchDIs = useCallback(async () => {
    const res = await fetch(`/api/di?routingStepId=${params.stepId}&disposition=UNDER_REVIEW`)
    if (res.ok) setOpenDIs(await res.json())
  }, [params])

  useEffect(() => {
    Promise.all([fetchStep(), fetchDIs()]).finally(() => setLoading(false))
  }, [fetchStep, fetchDIs])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showToast(msg: string, type: 'success' | 'warn' = 'success') {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 2800)
  }

  function openPanel(p: Panel) {
    setPanel(p)
    setQty('')
    setError('')
  }

  // ── Step actions: Pass | Reject ──────────────────────────────────────────

  async function submitAction(action: 'PASS' | 'REJECT') {
    const qtyNum = parseInt(qty)
    if (!qtyNum || qtyNum < 1) { setError('Enter a valid qty'); return }
    if (!step) return

    startTransition(async () => {
      const res = await fetch(
        `/api/jobs/${params.id}/parts/${params.partId}/steps/${params.stepId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, qty: qtyNum }),
        }
      )
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error')
        return
      }
      setPanel(null)
      showToast(`${qtyNum} pcs ${action === 'PASS' ? 'passed ✓' : 'rejected'}`)
      await fetchStep()
    })
  }

  // ── Raise DI ─────────────────────────────────────────────────────────────

  async function submitDI() {
    const qtyNum = parseInt(qty)
    if (!qtyNum || qtyNum < 1) { setError('Enter a valid qty'); return }
    if (step && qtyNum > step.qtyPending) {
      setError(`Only ${step.qtyPending} pcs are pending. Cannot raise DI for more.`)
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/di', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobPartId: params.partId,
          routingStepId: params.stepId,
          reason: diReason,
          description: diDesc || undefined,
          qty: qtyNum,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setPanel(null)
      setDiDesc('')
      showToast(`DI raised for ${qtyNum} pcs`, 'warn')
      await fetchDIs()
    })
  }

  // ── Resolve DI: Rework | Permanently Reject ──────────────────────────────

  async function resolveDI(diId: string, disposition: 'REWORK' | 'REJECTED', reworkTargetStepId?: string) {
    setResolvingDiId(diId)
    startTransition(async () => {
      const res = await fetch('/api/di', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: diId, disposition, reworkTargetStepId }),
      })
      if (!res.ok) {
        const d = await res.json()
        showToast(d.error ?? 'Failed to resolve DI', 'warn')
        setResolvingDiId(null)
        return
      }
      const label = disposition === 'REWORK' ? 'Parts sent to rework ↩' : 'Permanently rejected'
      showToast(label, disposition === 'REWORK' ? 'success' : 'warn')
      setResolvingDiId(null)
      await Promise.all([fetchStep(), fetchDIs()])
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#185FA5]/20 border-t-[#185FA5] rounded-full animate-spin" />
    </div>
  )

  if (!step) return <div className="p-6 text-gray-500">Step not found.</div>

  const isActive = step.status === 'IN_PROGRESS'
  const isDone = step.status === 'COMPLETED'
  const isStepPending = step.status === 'PENDING'

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-lg mx-auto">

      {/* Back */}
      <Link
        href={`/jobs/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 mb-4 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={16} /> {step.job.jobNumber}
      </Link>

      {/* Order info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{step.jobPart.partName}</h2>
            <p className="text-sm text-gray-400">{step.job.customerName}</p>
          </div>
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full',
            isActive ? 'pill-active' : isDone ? 'pill-pass' : 'pill-pending'
          )}>
            {step.operationName}
          </span>
        </div>
        {step.jobPart.drawingNumber && (
          <p className="text-xs text-gray-400">Dwg: {step.jobPart.drawingNumber}</p>
        )}
      </div>

      {/* PENDING — waiting for previous step */}
      {isStepPending && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F1EFE8] flex items-center justify-center mx-auto mb-3">
            <Circle size={24} className="text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Stage not started yet</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Parts will appear here once the previous stage is completed and parts are passed through.
          </p>
          <Link
            href={`/jobs/${params.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0C447C] bg-[#E6F1FB] px-3 py-2 rounded-lg mt-4 hover:bg-[#cce0f5] transition-colors"
          >
            <ArrowLeft size={12} /> View job routing
          </Link>
        </div>
      )}

      {/* Qty tracker — only show when stage has started */}
      {!isStepPending && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Qty at this stage
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'In', value: step.qtyIn, color: '#0C447C', bg: '#E6F1FB' },
              { label: 'Passed', value: step.qtyPassed, color: '#27500A', bg: '#EAF3DE' },
              { label: 'Rework', value: step.qtyRework, color: '#3C3489', bg: '#EEEDFE' },
              { label: 'Rejected', value: step.qtyRejected, color: '#791F1F', bg: '#FCEBEB' },
            ].map(q => (
              <div key={q.label} className="text-center rounded-xl py-3" style={{ background: q.bg }}>
                <div className="text-xl font-bold" style={{ color: q.color }}>{q.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: q.color }}>{q.label}</div>
              </div>
            ))}
          </div>
          {step.qtyPending > 0 && (
            <div className="mt-3 text-center text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{step.qtyPending}</span> pcs remaining
            </div>
          )}
          {isDone && (
            <div className="mt-3 text-center text-sm font-medium text-[#27500A] bg-[#EAF3DE] rounded-lg py-2">
              ✓ Stage completed
            </div>
          )}
        </div>
      )}

      {/* ── Primary action buttons: Pass | Raise DI | Reject ─────────────── */}
      {/* Note: No "Rework" button here. Rework happens via DI resolution below. */}
      {isActive && step.qtyPending > 0 && panel === null && (
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openPanel('pass')}
              className="btn-pass rounded-xl py-4 text-sm font-semibold touch-target flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={18} /> Pass
            </button>
            <button
              onClick={() => openPanel('di')}
              className="btn-warn rounded-xl py-4 text-sm font-semibold touch-target flex items-center justify-center gap-2 transition-colors"
            >
              <AlertTriangle size={18} /> Raise DI
            </button>
          </div>
          <button
            onClick={() => openPanel('reject')}
            className="btn-reject w-full rounded-xl py-3.5 text-sm font-semibold touch-target flex items-center justify-center gap-2 transition-colors"
          >
            <X size={16} /> Permanently Reject
          </button>
          <p className="text-[11px] text-gray-400 text-center pt-0.5">
            To send parts for rework, raise a DI first — then resolve it as rework below.
          </p>
        </div>
      )}

      {/* Pass panel */}
      {panel === 'pass' && (
        <div className="bg-white rounded-xl border border-[#97C459] p-4 mb-4">
          <div className="text-sm font-semibold text-[#27500A] mb-3">✓ Pass — how many pcs?</div>
          <input
            type="number" min="1" max={step.qtyPending} value={qty}
            onChange={e => { setQty(e.target.value); setError('') }}
            placeholder={`Max ${step.qtyPending}`}
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-2xl font-bold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 mb-3"
            autoFocus
          />
          {error && <p className="text-xs text-[#791F1F] mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPanel(null)} className="border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={() => submitAction('PASS')} disabled={isPending} className="btn-pass rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60">
              {isPending ? 'Saving…' : `Pass ${qty || '?'} pcs`}
            </button>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {panel === 'reject' && (
        <div className="bg-white rounded-xl border border-[#F09595] p-4 mb-4">
          <div className="text-sm font-semibold text-[#791F1F] mb-1">⚠ Permanent rejection</div>
          <p className="text-xs text-gray-500 mb-3">
            These parts will be permanently scrapped. This cannot be undone.<br />
            <span className="font-medium text-[#791F1F]">If you're unsure, raise a DI instead.</span>
          </p>
          <input
            type="number" min="1" max={step.qtyPending} value={qty}
            onChange={e => { setQty(e.target.value); setError('') }}
            placeholder={`Max ${step.qtyPending}`}
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-2xl font-bold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E84040]/30 mb-3"
            autoFocus
          />
          {error && <p className="text-xs text-[#791F1F] mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPanel(null)} className="border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
            <button onClick={() => submitAction('REJECT')} disabled={isPending} className="btn-reject rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60">
              {isPending ? 'Saving…' : `Reject ${qty || '?'} pcs`}
            </button>
          </div>
        </div>
      )}

      {/* DI creation panel */}
      {panel === 'di' && (
        <div className="bg-white rounded-xl border border-[#EF9F27] p-4 mb-4">
          <div className="text-sm font-semibold text-[#633806] mb-3">▲ Raise Discrepancy Issue</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Qty affected <span className="text-gray-400">(max {step.qtyPending})</span>
              </label>
              <input
                type="number" min="1" max={step.qtyPending} value={qty}
                onChange={e => { setQty(e.target.value); setError('') }}
                placeholder={`1 – ${step.qtyPending}`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EF9F27]/30"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">What is the issue?</label>
              <select value={diReason} onChange={e => setDiReason(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#EF9F27]/30">
                {DI_REASONS.map(r => <option key={r} value={r}>{diReasonLabel(r)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Description (optional)</label>
              <textarea rows={2} value={diDesc} onChange={e => setDiDesc(e.target.value)}
                placeholder="Describe the issue…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#EF9F27]/30" />
            </div>
            <p className="text-[11px] text-gray-400">
              You'll decide whether to rework or scrap after reviewing the DI below.
            </p>
          </div>
          {error && <p className="text-xs text-[#791F1F] mt-2">{error}</p>}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => setPanel(null)} className="border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
            <button onClick={submitDI} disabled={isPending} className="btn-warn rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60">
              {isPending ? 'Saving…' : 'Save DI'}
            </button>
          </div>
        </div>
      )}

      {/* ── Open DIs section ─────────────────────────────────────────────── */}
      {/* Always visible (even on completed steps), so supervisors can resolve DIs */}
      {openDIs.length > 0 && panel === null && (
        <div className="bg-white rounded-xl border border-[#EF9F27] overflow-hidden mb-4">
          {/* Collapsible header */}
          <button
            onClick={() => setDiSectionOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#FAEEDA] border-b border-[#EF9F27]/40 text-left touch-target"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#633806]" />
              <span className="text-sm font-semibold text-[#633806]">
                Open DIs — {openDIs.length} pending resolution
              </span>
            </div>
            {diSectionOpen
              ? <ChevronUp size={16} className="text-[#633806]" />
              : <ChevronDown size={16} className="text-[#633806]" />
            }
          </button>

          {diSectionOpen && (
            <div className="divide-y divide-[#EF9F27]/20">
              {openDIs.map(di => (
                <DICard
                  key={di.id}
                  di={di}
                  siblingSteps={step?.siblingSteps ?? []}
                  currentStepId={params.stepId}
                  isResolving={resolvingDiId === di.id && isPending}
                  onRework={(targetStepId) => resolveDI(di.id, 'REWORK', targetStepId)}
                  onReject={() => resolveDI(di.id, 'REJECTED')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap',
          toastType === 'success' ? 'bg-[#1D9E75]' : 'bg-[#EF9F27]'
        )}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── DI Card sub-component ─────────────────────────────────────────────────

function DICard({
  di,
  siblingSteps,
  currentStepId,
  isResolving,
  onRework,
  onReject,
}: {
  di: DI
  siblingSteps: SiblingStep[]
  currentStepId: string
  isResolving: boolean
  onRework: (targetStepId: string) => void
  onReject: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  // Default to the step immediately before the current one, or the first step
  const defaultTarget = (() => {
    const sorted = [...siblingSteps].sort((a, b) => a.sequence - b.sequence)
    const curr = sorted.find(s => s.id === currentStepId)
    if (!curr) return sorted[0]?.id ?? currentStepId
    const prev = sorted.filter(s => s.sequence < curr.sequence).pop()
    return prev?.id ?? sorted[0]?.id ?? currentStepId
  })()
  const [targetStepId, setTargetStepId] = useState(defaultTarget)

  return (
    <div className="p-4">
      {/* DI header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#633806]">{diReasonLabel(di.reason)}</span>
            <span className="pill-warn text-[11px] font-medium px-2 py-0.5 rounded-full">{di.qty} pcs</span>
          </div>
          {di.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{di.description}</p>}
          <p className="text-[10px] text-gray-400 mt-1">
            Raised by {di.updatedByName} · {new Date(di.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
          {di.reworkTargetStepName && (
            <p className="text-[10px] text-[#3C3489] mt-0.5">↩ Sent to {di.reworkTargetStepName}</p>
          )}
        </div>
      </div>

      {!pickerOpen && (
        <>
          <p className="text-[11px] text-[#633806] bg-[#FAEEDA]/60 rounded-lg px-3 py-1.5 mb-3">
            Decision required — what should happen to these {di.qty} part{di.qty !== 1 ? 's' : ''}?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              disabled={isResolving}
              className="btn-rework rounded-lg py-2.5 text-sm font-semibold touch-target flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <RefreshCw size={14} /> Send to Rework
            </button>
            <button
              onClick={onReject}
              disabled={isResolving}
              className="btn-reject rounded-lg py-2.5 text-sm font-semibold touch-target flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {isResolving
                ? <div className="w-4 h-4 border-2 border-[#791F1F]/30 border-t-[#791F1F] rounded-full animate-spin" />
                : <><X size={14} /> Scrap (Reject)</>}
            </button>
          </div>
        </>
      )}

      {/* ── Rework step picker (expands inline) ─── */}
      {pickerOpen && (
        <div className="bg-[#EEEDFE] border border-[#3C3489]/20 rounded-xl p-3">
          <p className="text-xs font-semibold text-[#3C3489] mb-2">
            ↩ Where should these {di.qty} part{di.qty !== 1 ? 's' : ''} re-enter?
          </p>
          <select
            value={targetStepId}
            onChange={e => setTargetStepId(e.target.value)}
            className="w-full border border-[#3C3489]/30 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 mb-3"
          >
            {siblingSteps.map(s => (
              <option key={s.id} value={s.id}>
                Step {s.sequence}: {s.operationName}
                {s.id === currentStepId ? ' (this step)' : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[#3C3489]/70 mb-3">
            The selected step will re-open with +{di.qty} pcs. Parts will flow through the normal routing from there.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setPickerOpen(false) }}
              className="border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => { onRework(targetStepId); setPickerOpen(false) }}
              disabled={isResolving || !targetStepId}
              className="btn-rework rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isResolving
                ? <div className="w-4 h-4 border-2 border-[#3C3489]/30 border-t-[#3C3489] rounded-full animate-spin" />
                : <><RefreshCw size={13} /> Confirm Rework</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
