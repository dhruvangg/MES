// app/(dashboard)/settings/page.tsx
import { getSession } from '@/lib/auth'
import { User } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-4xl mx-auto space-y-6">
      
      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <User size={18} className="text-[#185FA5]" />
          <h2 className="text-sm font-semibold text-gray-800">User Profile</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">Name</label>
            <div className="text-sm font-medium text-gray-900 mt-1">{session?.name || 'Operator'}</div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">Email Address</label>
            <div className="text-sm font-medium text-gray-900 mt-1">{session?.email || 'admin@mes.local'}</div>
          </div>
        </div>
      </div>

    </div>
  )
}
