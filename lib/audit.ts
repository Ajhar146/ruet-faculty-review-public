import type { AuditAction } from '@/lib/types'
import { prisma } from '@/lib/prisma'

/**
 * Writes down that something happened.
 *
 * Every admin action calls this LAST, after its own write has succeeded, so
 * the log never claims something that did not happen.
 *
 * It does not swallow errors. If someone complains in six months, this
 * table is the only record there will be, so a broken audit write is worth
 * knowing about immediately rather than discovering later that months of
 * decisions were never recorded.
 *
 * actorId is null when the system did it, not a person. Auto-hide after
 * reports is the usual case.
 */
export async function logAudit(entry: {
  actorId: string | null
  action: AuditAction
  targetType: string
  targetId?: string
  meta?: Record<string, unknown>
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      meta: entry.meta ?? undefined,
    },
  })
}

