'use client'
// app/(dashboard)/jobs/new/page.tsx — 3-step New Job Wizard
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Customer = { id: string; name: string; code: string | null }
type Part = { id: string; name: string; code: string | null }
type Operation = { id: string; name: string; code: string | null }
type PartRow = { partId: string; partName: string; drawingNumber?: string; qty: number; routing: string[] }

const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT', 'LOW']
const STEPS = ['Order details', 'Parts & routing', 'Review']

export default function NewJobPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)

  // Step 1 fields
  const [customerId, setCustomerId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [notes, setNotes] = useState('')

  // Step 2 fields
  const [parts, setParts] = useState<PartRow[]>([])
  const [selectedOps, setSelectedOps] = useState<string[]>([])

  // New part inputs
  const [newPartId, setNewPartId] = useState('')
  const [newPartQty, setNewPartQty] = useState('')
  const [newDrawing, setNewDrawing] = useState('')

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [partsList, setPartsList] = useState<Part[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/parts').then(r => r.json()),
      fetch('/api/operations').then(r => r.json()),
    ]).then(([c, p, o]) => {
      setCustomers(c)
      setPartsList(p)
      setOperations(o)
    })
  }, [])

  function toggleOp(opId: string) {
    setSelectedOps(prev =>
      prev.includes(opId) ? prev.filter(id => id !== opId) : [...prev, opId]
    )
  }

  function addPart() {
    if (!newPartId || !newPartQty) { setError('Select a part and enter qty'); return }
    const qty = parseInt(newPartQty)
    if (qty < 1) { setError('Qty must be at least 1'); return }
    if (selectedOps.length === 0) { setError('Select at least one operation'); return }

    const p = partsList.find(p => p.id === newPartId)
    if (!p) return

    setParts(prev => [...prev, {
      partId: newPartId,
      partName: p.name,
      drawingNumber: newDrawing || undefined,
      qty,
      routing: [...selectedOps],
    }])
    setNewPartId('')
    setNewPartQty('')
    setNewDrawing('')
    setError('')
  }

  function removePart(index: number) {
    setParts(prev => prev.filter((_, i) => i !== index))
  }

  function validateStep1() {
    if (!customerId) { setError('Select a customer'); return false }
    return true
  }

  function validateStep2() {
    if (parts.length === 0) { setError('Add at least one part'); return false }
    return true
  }

  function goNext() {
    setError('')
    if (step === 0 && !validateStep1()) return
    if (step === 1 && !validateStep2()) return
    setStep(s => s + 1)
  }

  async function submitJob() {
    startTransition(async () => {
      const body = {
        customerId,
        poNumber: poNumber || undefined,
        dueDate: dueDate || undefined,
        priority,
        notes: notes || undefined,
        parts: parts.map(p => ({
          partId: p.partId,
          totalQty: p.qty,
          routing: p.routing.map((opId, i) => ({ operationId: opId, sequence: i + 1 })),
        })),
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to create job')
        return
      }

      const job = await res.json()
      router.push(`/jobs/${job.id}`)
    })
  }

  const customerName = customers.find(c => c.id === customerId)?.name

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-lg mx-auto">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 mb-4 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Job board
      </Link>

      {/* Step pills */}
      <div className="flex gap-1.5 mb-2">
        {STEPS.map((_, i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors',
            i < step ? 'bg-[#1D9E75]' : i === step ? 'bg-[#185FA5]' : 'bg-gray-200')} />
        ))}
      </div>
      <div className="text-xs text-gray-400 mb-4">Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>

      {/* Step 1: Order details */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Customer & order</div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Customer *</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">PO number</label>
                <input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-2025-XXX"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Priority</label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors touch-target',
                      priority === p ? (p === 'URGENT' ? 'pill-reject' : p === 'HIGH' ? 'pill-warn' : p === 'LOW' ? 'pill-pending' : 'pill-active') : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    )}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Parts & routing */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Select operations (workflow) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Workflow — tap to select operations in order
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {operations.map((op, i) => {
                const idx = selectedOps.indexOf(op.id)
                const selected = idx !== -1
                return (
                  <button key={op.id} onClick={() => toggleOp(op.id)}
                    className={cn('flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border transition-all touch-target',
                      selected ? 'bg-[#E6F1FB] border-[#85B7EB] text-[#0C447C] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}>
                    <span>{op.name}</span>
                    {selected && <span className="text-xs font-bold bg-[#185FA5] text-white rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span>}
                  </button>
                )
              })}
            </div>
            {selectedOps.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500">
                <span className="text-gray-400">Workflow:</span>
                {selectedOps.map((opId, i) => {
                  const op = operations.find(o => o.id === opId)
                  return (
                    <span key={opId} className="flex items-center gap-1">
                      <span className="bg-[#E6F1FB] text-[#0C447C] border border-[#85B7EB] px-2 py-0.5 rounded-full font-medium">{op?.name}</span>
                      {i < selectedOps.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Add parts */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Parts & quantities</div>
            {parts.length > 0 && (
              <div className="space-y-2 mb-3">
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{p.partName}</div>
                      <div className="text-xs text-gray-400">{p.routing.map(id => operations.find(o => o.id === id)?.name).join(' → ')}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700 flex-shrink-0">{p.qty} pcs</div>
                    <button onClick={() => removePart(i)} className="text-gray-300 hover:text-[#791F1F] transition-colors p-1 touch-target">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <select value={newPartId} onChange={e => setNewPartId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                <option value="">Select part…</option>
                {partsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input value={newPartQty} onChange={e => setNewPartQty(e.target.value)} type="number" min="1" placeholder="Qty"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
                <input value={newDrawing} onChange={e => setNewDrawing(e.target.value)} placeholder="Drawing no. (opt.)"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
              </div>
              <button onClick={addPart} className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors flex items-center justify-center gap-2 touch-target">
                <Plus size={16} /> Add part
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Review order</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{customerName}</span></div>
              {poNumber && <div className="flex justify-between"><span className="text-gray-500">PO</span><span className="font-medium">{poNumber}</span></div>}
              {dueDate && <div className="flex justify-between"><span className="text-gray-500">Due date</span><span className="font-medium">{dueDate}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-medium">{priority}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Parts</span><span className="font-medium">{parts.length}</span></div>
            </div>
          </div>
          {parts.map((p, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-900">{p.partName}</span>
                <span className="text-sm font-bold text-gray-700">{p.qty} pcs</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {p.routing.map((opId, j) => {
                  const op = operations.find(o => o.id === opId)
                  return (
                    <span key={opId} className="flex items-center gap-1">
                      <span className="bg-[#E6F1FB] text-[#0C447C] border border-[#85B7EB] px-2 py-0.5 rounded-full text-xs font-medium">{op?.name}</span>
                      {j < p.routing.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-[#791F1F] bg-[#FCEBEB] border border-[#F09595] rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Navigation */}
      <div className={cn('grid gap-3 mt-4', step > 0 ? 'grid-cols-2' : 'grid-cols-1')}>
        {step > 0 && (
          <button onClick={() => { setStep(s => s - 1); setError('') }}
            className="border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors touch-target">
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={goNext}
            className="btn-primary rounded-xl py-3 text-sm font-semibold touch-target transition-colors">
            Next: {STEPS[step + 1]} →
          </button>
        ) : (
          <button onClick={submitJob} disabled={isPending}
            className="btn-success rounded-xl py-3 text-sm font-semibold touch-target disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
            {isPending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</> : <><Check size={16} /> Create order</>}
          </button>
        )}
      </div>
    </div>
  )
}
