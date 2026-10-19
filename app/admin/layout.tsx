import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'

// Admins only. Everyone else gets a 404, so the area does not seem to exist.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return children
}
