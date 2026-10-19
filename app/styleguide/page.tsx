'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Select,
  SkeletonCard,
  SkeletonList,
  StarRating,
  Textarea,
} from '@/components/ui'

const COLOURS = [
  { name: 'canvas', hex: '#F0F4F9', swatch: 'bg-canvas', use: 'Page background' },
  { name: 'paper', hex: '#FFFFFF', swatch: 'bg-paper', use: 'Cards, inputs, header, footer' },
  { name: 'ink', hex: '#16243D', swatch: 'bg-ink', use: 'Headings, body, primary button' },
  { name: 'slate', hex: '#5B6B84', swatch: 'bg-slate', use: 'Secondary text, captions' },
  { name: 'line', hex: '#E4E7EC', swatch: 'bg-line', use: 'Borders and dividers' },
  { name: 'mist', hex: '#F7F8FA', swatch: 'bg-mist', use: 'Subtle panel background' },
  { name: 'accent', hex: '#B8860B', swatch: 'bg-accent', use: 'Thin rules and active states' },
]

const DEPARTMENTS = [
  { value: 'cse', label: 'Computer Science and Engineering' },
  { value: 'eee', label: 'Electrical and Electronic Engineering' },
  { value: 'me', label: 'Mechanical Engineering' },
]

const HALF_FULL =
  'Lectures were clear and the worked examples in class helped me understand the topic well before the exam.'

const OVER_LIMIT =
  'This answer is deliberately longer than the limit so the counter turns red.'

// Long on purpose. The first two names must elide in a list row, and the
// department name is the one that used to wrap to three lines.
const ROWS = [
  {
    name: 'Dr. Md Rafiqul Uz Bari',
    meta: 'Professor · Head of department · CSE',
    value: '4.4',
  },
  { name: 'A. K. M. Minhazul Rahman', meta: 'Assistant Professor · EEE', value: '4.1' },
  { name: 'Mst. Farzana Yasmin Tonni', meta: 'Lecturer · ETE', value: '3.9' },
  { name: 'Md Abdul Karim Bin Rafiq', meta: 'Associate Professor · ME', value: null },
  { name: 'Sheikh Md Tanvir Hossain', meta: 'Professor · EEE', value: '4.6' },
  { name: 'Nayeem Hasan Talukder', meta: 'Assistant Professor · BECM', value: '3.7' },
]

const MENU_ROWS = ['Teachers', 'My reviews', 'Admin', 'Sign out']

// Stands in for the 40px round photo, so a row measures honestly here
// without needing a real image.
function RowAvatar({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-[15px] font-semibold text-slate md:size-16 md:text-[20px]"
    >
      {letter}
    </span>
  )
}

function MagnifierIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-5"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M13.5 13.5 18 18" />
    </svg>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-12">
      <h2 className="text-[28px] leading-[1.2] font-bold text-ink">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[13px] text-slate">{children}</p>
}

export default function StyleguidePage() {
  // DEVELOPMENT ONLY. This is a developer reference -- every component, every
  // colour, every state on one page -- and it has no business existing on the
  // live site for anyone, including the owner.
  //
  // NOT an auth check. Gating it behind a session would still leave it on the
  // production site for every student the moment they sign in, and it is not
  // a page any of them should ever reach. This removes it instead.
  //
  // notFound(), not redirect() and not a 403: a 404 is the only answer that
  // does not confirm the page is there.
  //
  // process.env.NODE_ENV is inlined by the bundler, so in a production build
  // this is the literal `if (true)` and everything below it is unreachable --
  // the guard cannot be raced, and it costs nothing in dev.
  //
  // /styleguide stays in MUST_STAY_BLOCKED in lib/public-routes.ts. That keeps
  // it out of the index; this keeps it off the server. Both, not either.
  if (process.env.NODE_ENV === 'production') notFound()

  const [rating, setRating] = useState(3)
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <main>
      {/* Container, not a hand-written copy of it. The values happened to
          match today, but two definitions of one gutter is how they stop
          matching. */}
      <Container className="py-16">
      <h1 className="text-[48px] leading-[1.2] font-bold text-ink">Styleguide</h1>
      <p className="mt-4 text-[16px] text-slate">
        Every component in every state. Check this page after any change to the design
        system.
      </p>

      <div className="mt-16 flex flex-col gap-16">
        <Section title="Colour">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {COLOURS.map((colour) => (
              <div key={colour.name}>
                <div
                  className={`h-20 w-full rounded-control border border-line ${colour.swatch}`}
                />
                <p className="mt-3 text-[15px] font-medium text-ink">{colour.name}</p>
                <p className="text-[13px] text-slate">{colour.hex}</p>
                <p className="text-[13px] text-slate">{colour.use}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale">
          <div className="flex flex-col gap-6">
            <div>
              <Label>48px bold &middot; page heading</Label>
              <p className="text-[48px] leading-[1.2] font-bold text-ink">
                Find your RUET teachers
              </p>
            </div>
            <div>
              <Label>28px bold &middot; section heading</Label>
              <p className="text-[28px] leading-[1.2] font-bold text-ink">
                Highest rated teachers
              </p>
            </div>
            <div>
              <Label>20px semibold &middot; card heading</Label>
              <p className="text-[20px] leading-[1.2] font-semibold text-ink">
                Dr. Md Rafiqul Uz Bari
              </p>
            </div>
            <div>
              <Label>16px regular &middot; page subtitle</Label>
              <p className="text-[16px] text-slate">
                Read what students say about teaching and course experience.
              </p>
            </div>
            <div>
              <Label>15px regular &middot; body</Label>
              <p className="max-w-[70ch] text-[15px] text-ink">
                Lectures were clear but the exam was harder than expected. The lab
                sessions were the most useful part of the course.
              </p>
            </div>
            <div>
              <Label>13px regular &middot; caption</Label>
              <p className="text-[13px] text-slate">12 March 2026</p>
            </div>
          </div>
        </Section>

        <Section title="Bilingual names">
          <div className="flex flex-col gap-6 md:flex-row md:gap-16">
            <div>
              <Label>Default font &middot; Plus Jakarta Sans</Label>
              <p className="text-[20px] leading-[1.2] font-semibold text-ink">
                Dr. Md Rafiqul Uz Bari
              </p>
            </div>
            <div>
              <Label>.bn class &middot; Hind Siliguri</Label>
              <p className="bn text-[20px] leading-[1.2] font-semibold text-ink">
                ডঃ মোঃ শহীদ উজ জামান
              </p>
            </div>
          </div>
        </Section>

        <Section title="Button">
          {/* One style for every button on the site: ink background, paper
              text. There is no outline or secondary button any more. */}
          <div className="flex flex-wrap items-center gap-4">
            <Button>Post your review</Button>
            <Button loading>Posting your review</Button>
            <Button disabled>Post your review</Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Label>ghost &middot; a text link, not a button</Label>
            <Button variant="ghost">Cancel</Button>
          </div>
        </Section>

        <Section title="Input">
          <div className="flex max-w-md flex-col gap-5">
            <Input label="Your name" placeholder="Type your name" />
            <Input
              label="RUET email"
              hint="Use the address your department gave you."
              placeholder="you@student.ruet.ac.bd"
            />
            <Input
              label="RUET email"
              error="That address is not a RUET email. Use your student address."
              defaultValue="me@gmail.com"
            />
            <Input label="Semester" required placeholder="Spring 2026" />
          </div>
        </Section>

        <Section title="Textarea">
          <div className="flex max-w-md flex-col gap-8">
            <div>
              <Label>Empty</Label>
              <Textarea
                label="Your feedback"
                hint="Write about the teaching, not the person."
                maxLength={200}
              />
            </div>
            <div>
              <Label>Half full</Label>
              <Textarea label="Your feedback" maxLength={200} defaultValue={HALF_FULL} />
            </div>
            <div>
              <Label>Over the limit</Label>
              <Textarea label="Your feedback" maxLength={40} defaultValue={OVER_LIMIT} />
            </div>
          </div>
        </Section>

        <Section title="Select">
          <div className="flex max-w-md flex-col gap-5">
            <Select
              label="Department"
              options={DEPARTMENTS}
              placeholder="Choose a department"
              defaultValue=""
            />
            <Select
              label="Department"
              options={DEPARTMENTS}
              placeholder="Choose a department"
              defaultValue=""
              error="Pick a department before you continue."
            />
          </div>
        </Section>

        <Section title="Star rating">
          <div className="flex flex-col gap-6">
            <div>
              <Label>Read only, 4.35</Label>
              <StarRating readOnly value={4.35} />
            </div>
            <div>
              <Label>Interactive &middot; use the left and right arrow keys</Label>
              <StarRating value={rating} onChange={setRating} label="Teaching quality" />
            </div>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-lg">
            <h3 className="text-[20px] leading-[1.2] font-semibold text-ink">
              Anonymous Student
            </h3>
            <p className="mt-3 max-w-[70ch] text-[15px] text-ink">
              Lectures were clear but the exam was harder than expected. The lab sessions
              were the most useful part of the course.
            </p>
            <p className="mt-4 text-[13px] text-slate">CSE 3201 &middot; Spring 2026</p>
          </Card>
        </Section>

        <Section title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="neutral">Pending</Badge>
            <Badge variant="success">Published</Badge>
            <Badge variant="danger">Rejected</Badge>
          </div>
        </Section>

        <Section title="Empty state">
          <div className="flex flex-col gap-8">
            <div>
              <Label>With an action</Label>
              <EmptyState
                heading="No reviews yet"
                message="Be the first student to write about this teacher."
                action={<Button>Write a review</Button>}
              />
            </div>
            <div>
              <Label>Without an action</Label>
              <EmptyState
                heading="No teachers match that search"
                message="Try a shorter name, or pick a department instead."
              />
            </div>
          </div>
        </Section>

        <Section title="Skeleton">
          <div className="flex flex-col gap-8">
            <div>
              <Label>SkeletonCard</Label>
              <SkeletonCard className="max-w-lg" />
            </div>
            <div>
              <Label>SkeletonList</Label>
              <SkeletonList count={3} className="max-w-lg" />
            </div>
          </div>
        </Section>

        <Section title="Modal">
          <Button onClick={() => setModalOpen(true)}>Report this review</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Report this review"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>Send the report</Button>
              </>
            }
          >
            <p className="max-w-[70ch]">
              Tell us why this review breaks the guidelines. An admin reads every report.
            </p>
            <div className="mt-4">
              <Textarea
                label="What is wrong with it?"
                maxLength={300}
                hint="Press Escape to close this dialog."
              />
            </div>
          </Modal>
        </Section>

        <Section title="Alert">
          <div className="flex max-w-lg flex-col gap-4">
            <Alert variant="info">
              Your review is waiting for a check. It appears once it is approved.
            </Alert>
            <Alert variant="warning" title="Reviews are paused">
              We are checking recent submissions for spam. You can still sign in.
            </Alert>
            <Alert variant="error" title="Something went wrong">
              We could not save your review. Please try again.
            </Alert>
          </div>
        </Section>

        <Section title="Pagination">
          <Pagination
            page={2}
            totalPages={7}
            hrefFor={(page) => `/styleguide?page=${page}`}
          />
        </Section>

        {/* ---------------------------------------------------------------
            Mobile. The rules are in docs/DESIGN-SYSTEM.md section 8b.

            Open this page at 360px. These are not illustrations: the class
            names below are the ones the real pages use.
            --------------------------------------------------------------- */}

        <Section title="Mobile · 1. Type scale">
          <p className="mb-6 text-[13px] text-slate md:text-[16px]">
            Narrow the window. Every line below steps up at 640px and again at
            768px. This paragraph is secondary text: 13px on a phone, 16px
            from md.
          </p>

          <div className="flex flex-col gap-5">
            <div>
              <Label>Page title &middot; 24 / 32 / 48</Label>
              <p className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
                Electrical and Electronic Engineering
              </p>
            </div>

            <div>
              <Label>Big section heading &middot; 22 / 28</Label>
              <p className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px]">
                Needs a decision
              </p>
            </div>

            <div>
              <Label>Section heading &middot; 20 / 24</Label>
              <p className="text-[20px] leading-[1.2] font-bold text-ink sm:text-[24px]">
                Reviews by course
              </p>
            </div>

            <div>
              <Label>Row title &middot; 15, then 20 at md</Label>
              <p className="text-[15px] leading-[1.3] font-semibold text-ink md:text-[20px] md:leading-[1.2]">
                Dr. Md Rafiqul Uz Bari
              </p>
            </div>

            <div>
              <Label>Body &middot; 15 at every width</Label>
              <p className="text-[15px] leading-relaxed text-ink">
                Lectures were clear and the worked examples in class helped
                before the exam.
              </p>
            </div>

            <div>
              <Label>Secondary &middot; 13, then 16 at md</Label>
              <p className="text-[13px] text-slate md:text-[16px]">
                Professor &middot; Head of department &middot; CSE
              </p>
            </div>
          </div>
        </Section>

        <Section title="Mobile · 2. Spacing scale">
          <div className="flex flex-col gap-6">
            <div>
              <Label>Card padding &middot; p-4, then md:p-6</Label>
              <div className="rounded-card border border-line bg-paper p-4 md:p-6">
                <p className="text-[15px] text-ink">
                  16px of padding on a phone, 24px from md.
                </p>
              </div>
            </div>

            <div>
              <Label>Gap between cards &middot; gap-3, then md:gap-4</Label>
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="rounded-card border border-line bg-paper p-4 md:p-6">
                  <p className="text-[15px] text-ink">First</p>
                </div>
                <div className="rounded-card border border-line bg-paper p-4 md:p-6">
                  <p className="text-[15px] text-ink">Second</p>
                </div>
              </div>
            </div>

            <div>
              <Label>
                Side gutter &middot; 24px on a phone, 40px from md. Every page
                gets this from Container, and nothing adds more on top.
              </Label>
              <div className="border border-line bg-mist px-6 py-3 md:px-10">
                <p className="text-[13px] text-slate">
                  312px of content remains at 360px wide.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Mobile · 3. Compact list row">
          <Label>
            Six rows. All six fit a 360px screen; from md each one becomes the
            card it used to be. The fourth has no value, and shows nothing
            rather than a line saying so.
          </Label>

          {/* The budget, so the rule can be measured and not just looked at.
              If a change pushes a row past 64px, six stop fitting. */}
          <p className="mb-4 text-[13px] text-slate">
            Budget: about 64px a row plus a 1px line, so roughly 390px for six.
            The dashed line below sits at 390px. On a phone the sixth row must
            end above it.
          </p>

          <div className="relative">
            {/* Only a ruler, and only where the list is a list. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[390px] right-0 left-0 z-10 flex items-center gap-2 md:hidden"
            >
              <span className="h-0 flex-1 border-t border-dashed border-accent" />
              <span className="text-[13px] text-slate">390px</span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:gap-4 md:divide-y-0">
              {ROWS.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center gap-3 py-3 md:items-start md:gap-4 md:rounded-card md:border md:border-line md:bg-paper md:p-6"
                >
                  <RowAvatar letter={row.name.charAt(0)} />

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
                    <span className="truncate text-[15px] leading-[1.3] font-semibold text-ink md:overflow-visible md:text-[20px] md:leading-[1.2] md:whitespace-normal">
                      {row.name}
                    </span>
                    <span className="truncate text-[13px] text-slate">{row.meta}</span>
                  </span>

                  {row.value ? (
                    <span className="shrink-0 text-[13px] text-ink md:hidden">
                      {row.value}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Mobile · 4. Filter sheet">
          <Label>
            One row on a phone: the search box, then Filters carrying the
            number of filters that are set. Tap it. From 640px the panel stops
            being a sheet and becomes the plain row of controls desktop shows
            today.
          </Label>

          <div className="flex items-start gap-2 sm:flex-col sm:gap-4">
            <div className="flex min-w-0 flex-1 gap-2 sm:w-full sm:flex-none sm:gap-3">
              <input
                type="search"
                aria-label="Search teachers"
                placeholder="Search teachers"
                className="h-11 w-full rounded-control border border-line bg-paper px-3 py-0 text-[16px] text-ink placeholder:text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:text-[15px]"
              />
              <button
                type="button"
                aria-label="Search teachers"
                className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-control bg-ink text-[15px] font-medium text-paper hover:bg-brand-hover sm:w-auto sm:px-5"
              >
                <span className="sm:hidden">
                  <MagnifierIcon />
                </span>
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            <div className="relative shrink-0 sm:w-full">
              <button
                type="button"
                onClick={() => setSheetOpen((current) => !current)}
                aria-expanded={sheetOpen}
                aria-controls="styleguide-filters"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control border border-line bg-paper px-4 text-[15px] font-medium text-ink sm:hidden"
              >
                Filters (2)
              </button>

              <div
                id="styleguide-filters"
                className={`${
                  sheetOpen ? 'flex' : 'hidden'
                } absolute top-full right-0 z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] flex-col gap-3 rounded-card border border-line bg-paper p-4 shadow-overlay sm:static sm:mt-0 sm:flex sm:w-auto sm:max-w-none sm:flex-row sm:items-end sm:gap-3 sm:border-0 sm:p-0 sm:shadow-none`}
              >
                <Select
                  label="Department"
                  options={DEPARTMENTS}
                  placeholder="All departments"
                />
                <Select
                  label="Sort by"
                  options={[
                    { value: 'name', label: 'Name' },
                    { value: 'rating', label: 'Highest rated' },
                  ]}
                />
                <Button type="button">Apply</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Mobile · 5. Tap targets">
          <Label>
            Nothing here is shorter than 44px. The dashed box is 44px, to
            measure against.
          </Label>

          <div className="flex flex-col gap-4">
            <div className="flex h-11 w-32 items-center justify-center border border-dashed border-line text-[13px] text-slate">
              44px
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button">Button &middot; min-h-11</Button>

              <button
                type="button"
                aria-label="Search teachers"
                className="inline-flex size-11 items-center justify-center rounded-control border border-line text-ink"
              >
                <MagnifierIcon />
              </button>

              <span className="text-[13px] text-slate">
                Icon only &middot; size-11, and an aria-label
              </span>
            </div>

            <div>
              <Label>Menu rows &middot; min-h-12, one thin line between</Label>
              <nav className="flex max-w-xs flex-col divide-y divide-line border-y border-line">
                {MENU_ROWS.map((item) => (
                  <span
                    key={item}
                    className="flex min-h-12 w-full items-center text-[15px] text-ink"
                  >
                    {item}
                  </span>
                ))}
              </nav>
            </div>
          </div>
        </Section>
      </div>
      </Container>
    </main>
  )
}
