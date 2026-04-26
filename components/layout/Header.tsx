'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/subscriptions': 'Subscriptions',
  '/calendar': 'Calendar',
  '/reports': 'Reports',
  '/reports/insights': 'AI Insights',
  '/cashflow': 'Cash Flow',
  '/settings/categories': 'Categories',
  '/settings/tags': 'Tags',
  '/settings/rules': 'Rules',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix + '/')) return title
  }
  return 'Finance Tracker'
}

export function Header() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-[56px] bg-white border-b border-[#e8ecf0] flex items-center justify-between px-6 flex-shrink-0">
      <h2 className="text-[22px] font-semibold font-heading text-[#1a2332]">{title}</h2>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7a8d]"
          />
          <input
            type="text"
            placeholder="Search transactions…"
            className="h-[32px] pl-8 pr-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] placeholder:text-[#b0bac6] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] w-[220px] transition-colors"
          />
        </div>

        <button className="relative h-[32px] w-[32px] flex items-center justify-center rounded-[8px] border border-[#e8ecf0] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f8fafc] transition-colors">
          <Bell size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}
