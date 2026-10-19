import type { Metadata } from 'next'
import { openGraph } from '@/lib/metadata'
import {
  Bullet,
  Bullets,
  Lead,
  Paragraph,
  PolicyPage,
  PolicySection,
  Rule,
} from '@/components/legal/PolicyPage'

export const metadata: Metadata = openGraph({
  path: '/guidelines',
  title: 'Review Guidelines — RUET Faculty Review',
  description:
    'What you can and cannot write in a review on RUET Faculty Review. Honest criticism of teaching is welcome. Personal attacks and accusations are not.',
})

/**
 * Public on purpose, like the other legal pages.
 *
 * A rejected student follows a link here from a rejection message, and the
 * rejection can reach them before they have signed in again. Teachers read
 * this page too, and a teacher who wants to know what the rules are should
 * not need an account to find out.
 *
 * The five items under "What we do not publish" are the five rejection
 * reasons in services/moderation/messages.ts, one to one. If the wording
 * here drifts, a student reading a rejection cannot find the rule it came
 * from, which is the whole point of the page.
 *
 * The layout is PolicyPage, shared with /privacy, /terms and /contact. This
 * is the only one of the four with a standfirst under the title, which is
 * why PolicyPage takes a `lead`.
 */

export default function GuidelinesPage() {
  return (
    <PolicyPage
      title="Review guidelines"
      lead="This site exists so students can tell each other what a course was really like. Honest and critical is fine. The rules below are about keeping it usable, not about keeping it polite."
    >
      <PolicySection heading="Write about the teaching">
        <Paragraph>
          The useful review answers what another student would want to know:
        </Paragraph>

        <Bullets>
          <Bullet>How clearly were the lectures explained?</Bullet>
          <Bullet>Was the marking fair and consistent?</Bullet>
          <Bullet>How heavy was the workload?</Bullet>
          <Bullet>Did the class start and finish on time?</Bullet>
          <Bullet>What would you tell someone taking this course next year?</Bullet>
        </Bullets>

        <Paragraph>
          A hard review is welcome. &quot;The lectures moved too fast and the slides
          were hard to follow&quot; is useful. So is &quot;the hardest course of the
          semester, but I learned the most in it.&quot;
        </Paragraph>
      </PolicySection>

      <PolicySection heading="What we do not publish">
        <Rule>
          <Lead>Insults about the person.</Lead> Write about the teaching, not the
          teacher&apos;s appearance, family, religion, or intelligence. &quot;The
          explanations were unclear&quot; is a review. &quot;He is an idiot&quot; is
          not.
        </Rule>

        <Rule>
          <Lead>Accusations we cannot check.</Lead> Claims about money, favouritism,
          harassment or any misconduct. We have no way to verify them, and publishing
          them could seriously harm someone who has done nothing wrong. If something
          like this happened to you, take it to the department, not to this site.
        </Rule>

        <Rule>
          <Lead>Contact details.</Lead> No phone numbers, email addresses or links —
          yours or anyone else&apos;s.
        </Rule>

        <Rule>
          <Lead>Abusive language.</Lead> Swearing and slurs, in any language or
          spelling.
        </Rule>

        <Rule>
          <Lead>Anything that is not a review.</Lead> Empty text, random letters,
          advertising, or messages meant for a person rather than for other students.
        </Rule>
      </PolicySection>

      <PolicySection heading="What happens after you submit">
        <Paragraph>Every review is checked automatically, in seconds.</Paragraph>

        <Bullets>
          <Bullet>If it passes, it appears straight away.</Bullet>
          <Bullet>
            If it does not, you are told why and you can edit it and submit again, up
            to three times.
          </Bullet>
          <Bullet>
            If you believe the decision was wrong, you can appeal once instead.
            Appeals are read by a person, roughly once a week. You will only hear back
            if the decision changes.
          </Bullet>
          <Bullet>
            It is one or the other, not both. Sending an appeal ends your remaining
            attempts: that review can no longer be edited or submitted again, whatever
            the admin decides. If you would rather fix the review than argue for it,
            edit and submit it again first.
          </Bullet>
        </Bullets>

        <Paragraph>
          No teacher, and no other student, is ever told who wrote a review.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="Reporting a review">
        <Paragraph>
          If a published review breaks these rules, use the Report button on it. When
          enough students report the same review, it is hidden automatically until
          someone looks at it.
        </Paragraph>

        <Paragraph>
          Report a review because it breaks a rule, not because you disagree with it.
        </Paragraph>
      </PolicySection>

      <PolicySection heading="One thing to be clear about">
        <Paragraph>
          These are unverified student opinions. We cannot confirm that a reviewer
          actually took the course, and we do not check whether anything in a review
          is true.
        </Paragraph>

        <Paragraph>This site is not affiliated with, or endorsed by, RUET.</Paragraph>
      </PolicySection>
    </PolicyPage>
  )
}
