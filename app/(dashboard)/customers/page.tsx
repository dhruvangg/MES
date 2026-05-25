// app/(dashboard)/customers/page.tsx
import { prisma } from '@/lib/prisma'
import { Users, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { jobs: true } } } })

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{customers.length} customers</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        {customers.length === 0 && (
          <div className="p-8 text-center text-gray-400">No customers yet.</div>
        )}
        <div className="divide-y divide-gray-100">
          {customers.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-[#0C447C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400">{c.code ?? ''} {c.phone ? `· ${c.phone}` : ''}</div>
              </div>
              <div className="text-xs text-gray-400">{c._count.jobs} jobs</div>
            </div>
          ))}
        </div>
      </div>

      {/* Inline add form */}
      <CustomerAddForm />
    </div>
  )
}

// Simple inline add — no modal needed
function CustomerAddForm() {
  return (
    <form action="/api/customers" method="POST" className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Add customer</div>
      <div className="space-y-2">
        <input name="name" required placeholder="Customer name *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
        <div className="grid grid-cols-2 gap-2">
          <input name="code" placeholder="Code (e.g. IR)" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
          <input name="phone" placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
        </div>
        <input name="email" type="email" placeholder="Email" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30" />
        <button type="submit" className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold touch-target flex items-center justify-center gap-2">
          <Plus size={16} /> Add customer
        </button>
      </div>
    </form>
  )
}
