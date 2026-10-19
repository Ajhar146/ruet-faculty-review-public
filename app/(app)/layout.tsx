import type { ReactNode } from 'react'
import { requireAuth } from '@/lib/auth'

// Every page under (app) needs a signed-in user: students and teachers.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireAuth()
  return children
}
