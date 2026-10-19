'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'
import { SESSION_COOKIE } from '@/lib/auth'

export async function signOut() {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value

  // Deleting the row is what actually ends the session. Clearing the cookie
  // alone would leave a copied cookie still working.
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } })
  }

  store.delete(SESSION_COOKIE)
  redirect('/login')
}
