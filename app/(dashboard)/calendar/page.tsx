import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDisplay, daysUntil } from '@/lib/dates'
import { formatCurrency } from '@/lib/money'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const WINDOWS = [30, 60, 90]

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const now = new Date()
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const subscriptions = await prisma.subscription.findMany({
    where: { isActive: true, nextDueDate: { lte: ninetyDaysOut } },
    include: { category: true },
    orderBy: { nextDueDate: 'asc' },
  })

  const upcomingItems = subscriptions.map((sub) => ({
    id: sub.id,
    name: sub.name,
    amount: sub.amount,
    date: sub.nextDueDate,
    daysAway: daysUntil(sub.nextDueDate),
    type: 'subscription' as const,
    color: sub.category.color,
  }))

  return (
    <div className="space-y-6">
      {WINDOWS.map((window) => {
        const items = upcomingItems.filter((item) => item.daysAway >= 0 && item.daysAway <= window)
        const windowItems = window === 30
          ? items
          : upcomingItems.filter((item) => {
              const prev = WINDOWS[WINDOWS.indexOf(window) - 1]
              return item.daysAway > prev && item.daysAway <= window
            })

        return (
          <Card key={window} padding={false}>
            <div className="px-5 py-4 border-b border-[#e8ecf0]">
              <CardHeader
                title={`Next ${window} Days`}
                subtitle={`${window === 30 ? items.length : windowItems.length} upcoming bill${(window === 30 ? items.length : windowItems.length) !== 1 ? 's' : ''}`}
              />
            </div>

            {(window === 30 ? items : windowItems).length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-[#6b7a8d]">
                No bills due in this window
              </div>
            ) : (
              <div className="divide-y divide-[#e8ecf0]">
                {(window === 30 ? items : windowItems).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <p className="text-[14px] font-medium text-[#1a2332]">{item.name}</p>
                        <p className="text-[12px] text-[#6b7a8d]">{formatDisplay(item.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={item.daysAway <= 3 ? 'over-budget' : 'default'}>
                        {item.daysAway === 0 ? 'Today' : `${item.daysAway}d`}
                      </Badge>
                      <p className="text-[14px] font-semibold font-tabular text-[#1a2332]">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
