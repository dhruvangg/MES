// app/(dashboard)/parts/page.tsx
import { prisma } from '@/lib/prisma'
import { Package, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PartsPage() {
  const parts = await prisma.part.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { jobParts: true } } } })

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{parts.length} parts</div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        {parts.length === 0 && <div className="p-8 text-center text-gray-400">No parts yet.</div>}
        <div className="divide-y divide-gray-100">
          {parts.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-[#EEEDFE] flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-[#3C3489]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-400">{p.code ?? ''}{p.description ? ` · ${p.description}` : ''}</div>
              </div>
              <div className="text-xs text-gray-400">{p._count.jobParts} uses</div>
            </div>
          ))}
        </div>
      </div>

      <form action="/api/parts" method="POST" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Add part</div>
        <div className="space-y-2">
          <input name="name" required placeholder="Part name *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
          <input name="code" placeholder="Part code (e.g. P-001)" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
          <input name="description" placeholder="Description (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
          <button type="submit" className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold touch-target flex items-center justify-center gap-2">
            <Plus size={16} /> Add part
          </button>
        </div>
      </form>
    </div>
  )
}
