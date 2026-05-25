'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Factory, LayoutDashboard, ClipboardList, Users, Package, Settings, LogOut, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/jobs', icon: ClipboardList, label: 'Job Board' },
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/customers', icon: Users, label: 'Customers' },
  { href: '/parts', icon: Package, label: 'Parts' },
  { href: '/operations', icon: Wrench, label: 'Operations' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[#185FA5] flex items-center justify-center flex-shrink-0">
          <Factory size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-none">MES Tracker</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Shop Floor</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors touch-target',
                isActive
                  ? 'bg-[#E6F1FB] text-[#0C447C]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User / logout */}
      <div className="border-t border-gray-100 px-2 py-3">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
          <div className="text-[10px] text-gray-400">Admin</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors touch-target"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
