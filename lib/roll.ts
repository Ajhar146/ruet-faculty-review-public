// A RUET student email is the roll number: 2103XXX@student.ruet.ac.bd.
//
// The roll itself is never stored. Only the two parts we need come out of
// it, and both are written once, when the account is created.

export type ParsedRoll = {
  // 2103XXX -> 2021
  batchYear: number
  // 2103XXX -> "03", which is the Department with rollCode "03"
  rollCode: string
}

const ROLL = /^\d{7}$/

/**
 * Returns null for anything that is not a 7-digit roll. A teacher address,
 * a name-based address and a malformed roll all land here. The caller must
 * then leave both fields null rather than guess.
 */
export function parseRoll(email: string): ParsedRoll | null {
  const [local, domain] = email.trim().toLowerCase().split('@')

  if (!domain) return null
  if (!ROLL.test(local)) return null

  return {
    batchYear: 2000 + Number(local.slice(0, 2)),
    rollCode: local.slice(2, 4),
  }
}
