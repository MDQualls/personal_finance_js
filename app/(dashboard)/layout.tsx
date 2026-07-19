import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { SessionProvider } from '@/components/layout/SessionProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const reviewCount = await prisma.transaction.count({ where: { needsReview: true, deletedAt: null } })

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar reviewCount={reviewCount} />
        <div className="flex-1 flex flex-col overflow-hidden ml-[220px]">
          <Header />
          <main className="flex-1 overflow-y-auto bg-[#f4f6f9] p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
