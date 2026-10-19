import { OAuth2Client } from 'google-auth-library'

/**
 * Google OAuth, wrapped thin. RUET runs Google Workspace, so the hd claim
 * on the id_token is what proves which domain an account belongs to.
 */

const SCOPES = ['openid', 'email', 'profile']

export const STATE_COOKIE = 'ruet_oauth_state'
export const CALLBACK_COOKIE = 'ruet_oauth_callback'

export const SHORT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 600,
}

/**
 * Only a same-site path is allowed back. Anything else, including
 * "//evil.example", becomes "/", so the login cannot be used as an open
 * redirect.
 */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/'
  }
  return value
}

function getRedirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) throw new Error('NEXT_PUBLIC_SITE_URL is not set.')
  return `${site.replace(/\/$/, '')}/api/auth/google/callback`
}

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set.')
  }

  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri: getRedirectUri(),
  })
}

export function getAuthUrl(state: string): string {
  return getClient().generateAuthUrl({
    scope: SCOPES,
    state,
    prompt: 'select_account',
  })
}

export type GoogleIdentity = {
  email: string
  hd: string | null
  emailVerified: boolean
}

export async function verifyCode(code: string): Promise<GoogleIdentity> {
  const client = getClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.id_token) throw new Error('Google returned no id_token.')

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload?.email) throw new Error('Google returned no email.')

  return {
    email: payload.email.toLowerCase(),
    hd: payload.hd ?? null,
    emailVerified: payload.email_verified === true,
  }
}
