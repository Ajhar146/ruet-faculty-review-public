import { SignInView } from '@/components/auth/SignInView'

/**
 * /login still exists and still works.
 *
 * requireAuth() sends a signed-out visitor here with a callbackUrl so they
 * land back where they were, and the Google round trip returns here with an
 * error code. What changed is that / renders the same screen directly rather
 * than redirecting here — see components/auth/SignInView.tsx.
 *
 * This URL is NOT indexable. It is in neither the sitemap nor the robots allow
 * list, and it still carries X-Robots-Tag: noindex, so the two URLs serving
 * this screen cannot compete in search. The clean one is the one Google gets.
 */

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, callbackUrl } = await searchParams

  return <SignInView error={error} callbackUrl={callbackUrl} />
}
