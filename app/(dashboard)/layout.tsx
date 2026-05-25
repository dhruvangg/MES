// app/(dashboard)/layout.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-full min-h-screen bg-[#F5F4F0]">
      {/* Desktop sidebar */}
      <Sidebar userName={session.name} />
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userName={session.name} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
