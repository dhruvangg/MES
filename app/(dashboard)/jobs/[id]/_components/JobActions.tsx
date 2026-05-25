'use client'
// app/(dashboard)/jobs/[id]/_components/JobActions.tsx
// Client component: Delete Job + Report link
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, FileText } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function JobActions({ jobId, isCompleted }: { jobId: string; isCompleted: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Could not delete job')
        return
      }
      router.push('/jobs')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Report link */}
      <Link
        href={`/jobs/${jobId}/report`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0C447C] bg-[#E6F1FB] px-3 py-1.5 rounded-lg hover:bg-[#cce0f5] transition-colors"
      >
        <FileText size={13} /> Report
      </Link>

      {/* Delete — hidden for completed jobs */}
      {!isCompleted && (
        <>
          <button
            onClick={() => { setConfirmOpen(true); setError('') }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#791F1F] bg-[#FCEBEB] px-3 py-1.5 rounded-lg hover:bg-[#f5d0d0] transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>

          {/* Confirm dialog */}
          {confirmOpen && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Delete job?</h3>
                <p className="text-sm text-gray-500 mb-4">
                  This will permanently delete all routing steps, production logs, and DIs for this job. This cannot be undone.
                </p>
                {error && <p className="text-xs text-[#791F1F] mb-3">{error}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className={cn(
                      'btn-reject rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60',
                    )}
                  >
                    {isPending ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
