import type { Metadata } from 'next'
import { openGraph } from '@/lib/metadata'
import {
  Lead,
  MailLink,
  Paragraph,
  PolicyPage,
  PolicySection,
} from '@/components/legal/PolicyPage'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata: Metadata = openGraph({
  path: '/contact',
  title: 'Contact RUET Faculty Review',
  description:
    'Contact RUET Faculty Review to report a problem, ask about a review, or get in touch if you are a teacher listed on the site.',
})

/**
 * The page a teacher with a complaint lands on, so it must work with no
 * account. It is also the shortest of the three on purpose: one address, and
 * three sentences about what to put in the message.
 *
 * The layout is PolicyPage, shared with /privacy, /guidelines and /terms.
 * This is the only one of the four whose sections carry no heading — it is
 * prose under one title, and giving it h2s would mean writing new words onto
 * a page that exists to make a promise.
 */

export default function ContactPage() {
  return (
    <PolicyPage title="Contact">
      <PolicySection>
        <Paragraph>
          One address:{' '}
          <Lead>
            <MailLink address={CONTACT_EMAIL} />
          </Lead>
        </Paragraph>

        <Paragraph>A person reads every message and replies within a week.</Paragraph>
      </PolicySection>

      <PolicySection>
        <Paragraph>
          <Lead>Write to us if you are a teacher</Lead> and a review about you breaks
          the guidelines. Include the link and say what is wrong with it. We will not
          tell you who wrote it, and we will not remove a review for being critical —
          but we will remove one that insults you, accuses you of something, or
          exposes private information.
        </Paragraph>

        <Paragraph>
          <Lead>Write to us if you are a student</Lead> and your review was rejected
          and you think the appeal was wrong, or you want your account deleted.
        </Paragraph>

        <Paragraph>
          <Lead>Write to us if you found a bug or a security problem.</Lead> Please
          tell us privately before telling anyone else.
        </Paragraph>
      </PolicySection>
    </PolicyPage>
  )
}
