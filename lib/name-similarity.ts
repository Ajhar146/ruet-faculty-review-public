/**
 * How close a typed query is to a teacher's name, for RANKING only.
 *
 * ------------------------------------------------------------------
 * WHY THIS EXISTS, WHEN pg_trgm IS ALREADY DOING THE MATCHING
 * ------------------------------------------------------------------
 *
 * pg_trgm decides WHO QUALIFIES. It is indexable, it runs in the database,
 * and it is the right tool for that. It is the wrong tool for ORDER.
 *
 * Measured, on the real four results for "manhaz" (names below are
 * pseudonyms; the scores were measured against the original rows):
 *
 *   name                       word_sim  strict  whole_sim  maxWordSim
 *   A. K. M. Minhazul Rahman      0.300   0.231      0.167       0.231
 *   Md Manirul Hasan              0.429   0.250      0.150       0.250
 *   Ritu Mandal                   0.429   0.273      0.167       0.273
 *   Ayesha Mazid Nahar            0.375   0.182      0.130       0.182
 *
 * Every trigram metric ranks Minhazul LAST or third. The reason is
 * structural, not a tuning problem: trigrams are three-letter windows, so
 * "manhaz" shares the whole leading window "man" with "Manirul" and
 * "Mandal", while with "Minhazul" it shares only the middle "nhaz". Prefixes
 * win and the human answer loses.
 *
 * A SUBSEQUENCE metric sees what a reader sees. Every letter of "manhaz"
 * appears in "minhazul", in order, with one substitution -- ratio 0.833,
 * against 0.500 for "Manirul". That puts the right teacher first.
 *
 * Normalised Levenshtein was tried too and is worse here: it ranks "Mandal"
 * (0.667) above "Minhazul" (0.625), because it charges for the two trailing
 * letters of "minhazul" that the query simply stops short of. A student who
 * half-remembers a name types a prefix of it, so trailing letters must be
 * cheap -- which is exactly what LCS gives and edit distance does not. It
 * would also need the fuzzystrmatch extension, which is not installed.
 *
 * RANKING ONLY. Nothing here filters. A teacher reaches this function only
 * because pg_trgm already said they were close enough, so a change in here
 * can reorder results but can never add or remove one.
 *
 * Pure, no database, no I/O, so it is cheap to call per candidate and easy
 * to test.
 */

/**
 * Length of the longest common subsequence of two strings.
 *
 * Two rows, not a full matrix: only the previous row is ever read, and the
 * longest name in the database is well under a hundred characters.
 */
function lcsLength(a: string, b: string): number {
  let previous = new Array<number>(b.length + 1).fill(0)
  let current = new Array<number>(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1])
    }
    const swap = previous
    previous = current
    current = swap
    current.fill(0)
  }

  return previous[b.length]
}

/** Words of a name, lowercased, with initials and punctuation dropped. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
}

/**
 * 0 to 1: how much of the query appears, in order, inside the single
 * best-matching WORD of the name.
 *
 * PER WORD, not against the whole name. Against the whole string almost any
 * query scores well, because a long name offers plenty of letters in plenty
 * of orders -- "A. K. M. Minhazul Rahman" would contain nearly any six
 * letters in some order. A word is the unit a person actually recognises.
 *
 * Words of one character are dropped: the initials in "A. F. M." are not
 * names a student is typing a misspelling of, and each one would otherwise
 * score 1.0 for any query starting with that letter.
 *
 * Returns 0 for an empty query or a name with no word longer than one
 * character, so a caller never has to special-case either.
 */
export function nameMatchScore(query: string, name: string): number {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return 0

  let best = 0

  for (const word of wordsOf(name)) {
    const ratio = lcsLength(needle, word) / needle.length
    if (ratio > best) best = ratio
  }

  return best
}
