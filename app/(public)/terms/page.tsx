import type { Metadata } from 'next'
import { openGraph } from '@/lib/metadata'
import {
  Bullet,
  Bullets,
  Lead,
  MailLink,
  Paragraph,
  PolicyPage,
  PolicySection,
} from '@/components/legal/PolicyPage'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata: Metadata = openGraph({
  path: '/terms',
  title: 'Terms of Use — RUET Faculty Review',
  description:
    'Terms for using RUET Faculty Review: who may sign in, what a review must be about, and what happens to reviews that break the rules.',
})

/**
 * Public, with no session, for the same reason as /privacy and /guidelines:
 * a teacher with a complaint has no account, and the section that tells them
 * what to do is on this page.
 *
 * The layout is PolicyPage, shared with /privacy, /guidelines and /contact.
 */

export default function TermsPage() {
  return (
    <PolicyPage title="Terms">
      <PolicySection heading="Who may use this site">
        <Paragraph>
          Current RUET students and teachers, signing in with a RUET email address.
          Only students may write reviews. Teachers and administrators can read.
        </Paragraph>

        <Paragraph>
          Do not share your account. Reviews written from a shared account cannot be
          trusted, and that is the whole point of the site.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="Writing a review">
        <Paragraph>
          You may review a teacher for a course in your own department&apos;s
          curriculum. What you may and may not write is on the guidelines page, and
          every review is checked automatically before it appears.
        </Paragraph>

        <Paragraph>
          If a review is not published you are told why, and you can edit it and
          submit it again up to three times, or appeal once. An appeal is read by a
          person, and that decision is final.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="What we may do">
        <Bullets>
          <Bullet>Remove or hide any review that breaks the guidelines.</Bullet>
          <Bullet>Hide a review automatically when several students report it.</Bullet>
          <Bullet>Suspend an account that abuses the site.</Bullet>
        </Bullets>
      </PolicySection>

      <PolicySection heading="What the reviews are">
        <Paragraph>
          <Lead>Reviews are the personal opinions of individual students.</Lead> We do
          not check whether anything in a review is true, and we cannot confirm that
          the person writing it took the course. Do not treat a rating as a measure of
          anybody&apos;s ability.
        </Paragraph>

        <Paragraph>
          Ratings are shown only once a course has enough reviews to mean anything.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="If you are a teacher">
        <Paragraph>
          If a review about you breaks the guidelines, write to{' '}
          <MailLink address={CONTACT_EMAIL} /> with the link and what is wrong with
          it. We read every message and reply within a week.
        </Paragraph>

        <Paragraph>
          We will not tell you who wrote a review, and we will not remove one simply
          because it is critical. We will remove one that insults you personally,
          accuses you of something, or exposes private information.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="No guarantee">
        <Paragraph>
          This site is run by a student, for free, in his spare time. It may be
          offline sometimes. It comes with no warranty of any kind.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="Not RUET">
        <Paragraph>
          This site is not affiliated with, endorsed by, or connected to Rajshahi
          University of Engineering &amp; Technology.
        </Paragraph>
      </PolicySection>
    </PolicyPage>
  )
}
