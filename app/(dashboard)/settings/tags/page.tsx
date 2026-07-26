import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TagsClient } from './TagsClient'

export default async function TagsSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })

  return <TagsClient tags={tags} />
}
