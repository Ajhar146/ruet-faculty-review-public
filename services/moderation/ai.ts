import { z } from 'zod'
import { MODERATION_JSON_SCHEMA, MODERATION_SYSTEM_PROMPT } from './prompt'

/**
 * The ONLY file that talks to an AI provider.
 *
 * It never throws. Every path returns an object, because the caller needs
 * a decision to record even when everything went wrong. A thrown error
 * would end up in a catch that does not know what to write.
 *
 * It sends the comment text and nothing else. Not the teacher, not the
 * student, not an id.
 */

const TIMEOUT_MS = 6000
const MAX_TOKENS = 300

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export const moderationScoresSchema = z.object({
  relevance: z.number().min(0).max(1),
  toxicity: z.number().min(0).max(1),
  spam: z.number().min(0).max(1),
  personal_attack: z.boolean(),
  personal_information: z.boolean(),
  serious_allegation: z.boolean(),
  decision: z.enum(['SAFE', 'SUSPICIOUS', 'HIGH_RISK', 'SPAM']),
})

export type ModerationScores = z.infer<typeof moderationScoresSchema>

export type ModerationOutput = {
  // ERROR is not a verdict. It means nobody decided, so nothing publishes.
  decision: ModerationScores['decision'] | 'ERROR'
  scores: ModerationScores | null
  model: string
  latencyMs: number
  error: string | null
}

type CallResult =
  | { ok: true; content: string }
  | { ok: false; error: string; body: string }

function failure(model: string, latencyMs: number, error: string): ModerationOutput {
  return { decision: 'ERROR', scores: null, model, latencyMs, error }
}

/** One HTTP call, with its own timeout. Never throws. */
async function postToGroq(apiKey: string, body: unknown): Promise<CallResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      return {
        ok: false,
        error: `http ${response.status}`,
        body: text.slice(0, 500),
      }
    }

    const parsed = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[]
    }

    const content = parsed.choices?.[0]?.message?.content

    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, error: 'empty reply', body: text.slice(0, 500) }
    }

    return { ok: true, content }
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
        ? `timeout after ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : 'network error'

    return { ok: false, error: reason, body: '' }
  } finally {
    clearTimeout(timer)
  }
}

function groqBody(
  model: string,
  comment: string,
  options: { reasoning: boolean; jsonSchema: boolean }
) {
  return {
    model,
    messages: [
      { role: 'system', content: MODERATION_SYSTEM_PROMPT },
      // Only the comment. Nothing that identifies anyone.
      { role: 'user', content: comment },
    ],
    temperature: 0,
    max_tokens: MAX_TOKENS,
    ...(options.reasoning ? { reasoning_effort: 'low' } : {}),
    response_format: options.jsonSchema
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'moderation',
            strict: true,
            schema: MODERATION_JSON_SCHEMA,
          },
        }
      : { type: 'json_object' },
  }
}

/**
 * A model that rejects one setting must not take every review down with
 * it. If the error names reasoning_effort or response_format, drop that
 * setting and try once more.
 */
function unsupported(body: string, setting: string): boolean {
  return body.toLowerCase().includes(setting)
}

async function callGroq(comment: string, model: string): Promise<ModerationOutput> {
  const apiKey = process.env.MODERATION_API_KEY

  const started = Date.now()

  if (!apiKey) {
    return failure(model, 0, 'MODERATION_API_KEY is not set')
  }

  let options = { reasoning: true, jsonSchema: true }
  let result = await postToGroq(apiKey, groqBody(model, comment, options))

  if (!result.ok && unsupported(result.body, 'reasoning_effort')) {
    console.warn('[moderation] reasoning_effort rejected, retrying without it')
    options = { ...options, reasoning: false }
    result = await postToGroq(apiKey, groqBody(model, comment, options))
  }

  if (
    !result.ok &&
    (unsupported(result.body, 'response_format') ||
      unsupported(result.body, 'json_schema'))
  ) {
    console.warn('[moderation] json_schema rejected, retrying with json_object')
    options = { ...options, jsonSchema: false }
    result = await postToGroq(apiKey, groqBody(model, comment, options))
  }

  if (!result.ok) {
    return failure(model, Date.now() - started, result.error)
  }

  const scores = parseScores(result.content)

  if (scores) {
    return {
      decision: scores.decision,
      scores,
      model,
      latencyMs: Date.now() - started,
      error: null,
    }
  }

  // Bad JSON once is a fluke. Twice is a broken model or a broken prompt,
  // and the review stays PENDING for a human.
  const retry = await postToGroq(apiKey, groqBody(model, comment, options))

  if (retry.ok) {
    const second = parseScores(retry.content)

    if (second) {
      return {
        decision: second.decision,
        scores: second,
        model,
        latencyMs: Date.now() - started,
        error: null,
      }
    }
  }

  return failure(model, Date.now() - started, 'reply was not valid moderation JSON')
}

function parseScores(content: string): ModerationScores | null {
  try {
    // Some models wrap JSON in a markdown fence even when told not to.
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim()

    const parsed = moderationScoresSchema.safeParse(JSON.parse(cleaned))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Adding a provider is one more branch here and nowhere else.
 */
export async function moderateComment(comment: string): Promise<ModerationOutput> {
  const provider = (process.env.MODERATION_PROVIDER ?? 'groq').toLowerCase()
  const model = process.env.MODERATION_MODEL ?? ''

  if (model.length === 0) {
    return failure(provider, 0, 'MODERATION_MODEL is not set')
  }

  if (provider === 'groq') return callGroq(comment, model)

  return failure(model, 0, `unknown MODERATION_PROVIDER: ${provider}`)
}
