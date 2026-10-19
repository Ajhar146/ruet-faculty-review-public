import type { ReactNode } from 'react'
import { requireStudent } from '@/lib/auth'

// Students only. A teacher who lands here gets a 404.
export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireStudent()
  return children
}
