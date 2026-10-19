import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Plus_Jakarta_Sans, Hind_Siliguri } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import MaintenancePage from '@/app/maintenance/page'
import { getCurrentUser } from '@/lib/auth'
import { getSetting } from '@/server/settings'
import { SchoolKeywordGate } from '@/components/auth/SchoolKeywordGate'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

const hind = Hind_Siliguri({
  subsets: ['bengali'],
  weight: ['400', '500', '600'],
  variable: '--font-hind',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RUET Faculty Review',
  description:
    'Read and write anonymous student reviews about teaching at RUET.',

  // RUET favicon
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },

  // Google Search Console. Next renders this as
  // <meta name="google-site-verification"> on every page, which is what
  // Google checks for at /.
  //
  // HARDCODED ON PURPOSE. It is published in the HTML of every page by
  // design, so it is not a secret, and an env var would be one more thing
  // that can be missing on Vercel and silently fail verification months
  // later with no error anywhere.
  verification: {
    google: 'G1xWCR44sA_tlapOj6CrU7FG4qAewsfvc15NPQVJIHU',
  },
}

// Paths that keep working while maintenance mode is on, for everyone.
//
// A signed-out admin is indistinguishable from a visitor, so the whole way
// back in has to stay open: the login page, the Google round trip, and the
// admin page the session lands on. Break any link in that chain and the
// switch locks the owner out of his own site with no way to turn it off.
//
// A non-admin can sign in during maintenance and then sees the maintenance
// page. That is correct. What must never happen is being unable to sign in.
const OPEN_WHILE_CLOSED = [
  '/login',
  // Starts the Google flow and receives the callback.
  '/api/auth/google',
  // UptimeRobot. A monitor must report the database, not the switch.
  '/api/health',
  // Where the switch is turned back off.
  '/admin',
  '/maintenance',
  // The four public pages. Static text that names no student, so there is
  // nothing to protect by hiding them — and /contact is how a teacher with
  // a complaint reaches a person. The site being down is exactly when they
  // are most likely to be looking for it, and the worst possible time for
  // the page that explains how to complain to answer with a holding notice.
  '/guidelines',
  '/privacy',
  '/terms',
  '/contact',
]

function isOpenPath(pathname: string): boolean {
  // x-pathname carries the query string too, so compare the path alone.
  const path = pathname.split('?')[0]

  return OPEN_WHILE_CLOSED.some(
    (open) => path === open || path.startsWith(`${open}/`)
  )
}

/**
 * The maintenance check lives here, in the layout, on the server.
 *
 * Not in proxy.ts: the proxy runs before routing and does not know which
 * page is being rendered or who is asking. This does.
 */
async function isClosedToThisVisitor(): Promise<boolean> {
  if ((await getSetting('maintenance_mode')) !== 'true') return false

  const pathname = (await headers()).get('x-pathname')

  // No header means the proxy did not run, so there is no way to tell which
  // page this is. Fail OPEN. Showing the site to someone during maintenance
  // is a small problem; hiding the sign-in page is a permanent lockout, and
  // this check must never be the reason the owner cannot get back in.
  if (pathname === null) return false

  if (isOpenPath(pathname)) return false

  // Only asked once maintenance is on, so a normal request still costs one
  // cached settings read and nothing more.
  const user = await getCurrentUser()
  return !user?.isAdmin
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const closed = await isClosedToThisVisitor()
  const user = await getCurrentUser()
  const isStudent = user?.role === 'STUDENT'

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${hind.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* No header while closed: it links into a site that is not
            answering. The footer stays, because every page has to say this
            site is not official. */}
        {closed ? null : <Header />}

        <div className="flex-1">
          {closed ? (
            <MaintenancePage />
          ) : isStudent && user ? (
            <SchoolKeywordGate userId={user.id}>{children}</SchoolKeywordGate>
          ) : (
            children
          )}
        </div>

        <Footer />
      </body>
    </html>
  )
}