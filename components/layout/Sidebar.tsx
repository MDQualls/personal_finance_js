'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  PiggyBank,
  Repeat,
  CalendarDays,
  BarChart2,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: CreditCard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/cashflow', label: 'Cash Flow', icon: TrendingUp },
]

const SETTINGS_ITEMS = [
  { href: '/settings/categories', label: 'Categories', icon: Settings },
  { href: '/settings/tags', label: 'Tags', icon: Settings },
  { href: '/settings/rules', label: 'Rules', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[#1a2332] flex flex-col z-10">
      <div className="px-5 py-6 border-b border-white/5">
        <h1 className="text-white font-semibold text-[16px] font-heading tracking-tight">
          Finance Tracker
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium font-heading transition-colors ${
              isActive(href)
                ? 'bg-[#00b89c] text-white'
                : 'text-[#8a9bb0] hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </Link>
        ))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[11px] font-medium font-heading text-[#8a9bb0]/50 uppercase tracking-wider">
            Settings
          </p>
        </div>

        {SETTINGS_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium font-heading transition-colors ${
              isActive(href)
                ? 'bg-[#00b89c] text-white'
                : 'text-[#8a9bb0] hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] text-[13px] font-medium font-heading text-[#8a9bb0] hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={20} strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
