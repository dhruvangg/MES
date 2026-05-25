'use client'
// components/layout/TopBar.tsx
import { usePathname } from 'next/navigation'
import { ClipboardList, LayoutDashboard, Users, Package, Wrench, Settings, Menu, Factory } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/jobs', icon: ClipboardList, label: 'Jobs' },
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/customers', icon: Users, label: 'Customers' },
  { href: '/parts', icon: Package, label: 'Parts' },
  { href: '/operations', icon: Wrench, label: 'Ops' },
]

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/jobs': 'Job Board',
  '/customers': 'Customers',
  '/parts': 'Parts',
  '/operations': 'Operations',
  '/settings': 'Settings',
}

export default function TopBar({ userName }: { userName: string }) {
  const pathname = usePathname()

  // Determine page title
  const title = Object.entries(pageTitles).find(([k]) => pathname === k || (k !== '/' && pathname.startsWith(k)))?.[1] ?? 'MES'

  return (
    <>
      {/* Desktop topbar */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 h-14 sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        <div className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#185FA5] flex items-center justify-center">
            <Factory size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 flex">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-[#185FA5]' : 'text-gray-400'
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
