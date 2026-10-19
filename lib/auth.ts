import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'

export const SESSION_COOKIE = 'ruet_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
}

/**
 * Wrapped in cache() so one page render hits the database once, however
 * many components ask who the user is.
 */
export const getSession = cache(async () => {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  })

  if (!session) return null
  if (session.expiresAt <= new Date()) return null

  return session
})

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    const path = (await headers()).get('x-pathname') ?? '/'
    redirect(`/login?callbackUrl=${encodeURIComponent(path)}`)
  }

  if (user.isBanned) redirect('/login?error=banned')

  return user
}

// A teacher who reaches a student-only page gets a 404, not an error. They
// should not have found it, and a 404 tells them nothing.
export async function requireStudent() {
  const user = await requireAuth()
  if (user.role !== 'STUDENT') notFound()
  return user
}

// 404, not 403. A 403 tells an attacker the admin area exists.
//
// isAdmin, not the role. Moderating is a job, not an identity: an admin
// can be a STUDENT who still writes reviews, or a TEACHER, or an account
// that does nothing else. The role keeps deciding what they may write.
export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) notFound()
  return user
}
