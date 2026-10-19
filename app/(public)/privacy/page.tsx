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
  path: '/privacy',
  title: 'Privacy Policy — RUET Faculty Review',
  description:
    'How RUET Faculty Review handles student data. Reviews are anonymous, your name is never shown with a review, and nothing is sold or shared.',
})

/**
 * Public, with no session. A teacher who wants to know what this site holds
 * about them has no account and is not going to make one to find out.
 *
 * The layout is PolicyPage, shared with /guidelines, /terms and /contact.
 * This file holds words and structure only — no width, gutter, alignment or
 * spacing decision is made here, because four pages making it separately is
 * how they drift.
 */

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy">
      <PolicySection heading="What we store">
        <Bullets>
          <Bullet>
            <Lead>Your RUET email address.</Lead> This is the only thing that proves
            you are a RUET student or teacher. We never show it to anyone.
          </Bullet>
          <Bullet>
            <Lead>Your reviews</Lead> — the ratings, the comment, the teacher, the
            course and the semester.
          </Bullet>
          <Bullet>
            <Lead>Browser storage and cookies.</Lead> A session cookie so you stay
            signed in, your local review draft if you start writing one, and your
            secret authorization recovery phrase stored locally on your device so
            you can manage or delete your anonymous reviews later.
          </Bullet>
        </Bullets>

        <Paragraph>
          We do not store your name, your roll number beyond the department it
          identifies, your phone number, or anything from your Google account other
          than your email address.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="What other people see">
        <Paragraph>
          Every review is shown as <Lead>Anonymous Student</Lead>
          . Your email address and your account are never attached to a review
          anywhere a person can see — not on a teacher&apos;s page, not in the page
          source, and not in the moderation screens.
        </Paragraph>

        <Paragraph>
          Published reviews do not include a direct reviewer identity, and the moderation
          interface does not expose review authors. Review management and duplicate
          prevention are handled through a separated privacy subsystem.
        </Paragraph>

        <Paragraph>
          As with any hosted web application, infrastructure-level metadata such as access logs,
          request timing, or privileged cloud access may create correlation risks. We therefore
          do not claim absolute untraceability against a fully privileged infrastructure operator.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="How long things are kept">
        <Paragraph>
          Published reviews stay until you delete them. A deleted or rejected review
          keeps a row in the database, without being shown anywhere, so that a
          decision can be checked later if someone disputes it.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="What you can do">
        <Bullets>
          <Bullet>
            Delete any review you wrote, from <Lead>My reviews</Lead>.
          </Bullet>
          <Bullet>
            Ask us what we hold about you, or ask us to delete your account, by
            writing to <MailLink address={CONTACT_EMAIL} />.
          </Bullet>
        </Bullets>
      </PolicySection>

      <PolicySection heading="Teacher photos and names">
        <Paragraph>
          Teacher names, designations, departments and photos are taken from
          RUET&apos;s public departmental pages. We do not collect or store any
          teacher&apos;s phone number or email address. A teacher who wants their
          photo removed can write to <MailLink address={CONTACT_EMAIL} />.
        </Paragraph>
      </PolicySection>
    </PolicyPage>
  )
}
