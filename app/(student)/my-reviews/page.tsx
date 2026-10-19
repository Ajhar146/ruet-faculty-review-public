import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
import { MyReviewsContent } from '@/components/review/MyReviewsContent'
import { requireStudent } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'My reviews | RUET Faculty Review',
}

export default async function MyReviewsPage() {
  await requireStudent()

  return (
    <main>
      <Container className="py-8 md:py-20">
        <MyReviewsContent />
      </Container>
    </main>
  )
}
