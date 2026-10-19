import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
import { DepartmentCard } from '@/components/teacher/DepartmentCard'
import { EmptyState } from '@/components/ui'
import { getDepartments } from '@/server/departments'

export const metadata: Metadata = {
  title: 'Departments | RUET Faculty Review',
}

export default async function DepartmentsPage() {
  const departments = await getDepartments()
  const teacherTotal = departments.reduce((sum, d) => sum + d.teacherCount, 0)

  return (
    <main>
      <Container className="py-8 md:py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            Departments
          </h1>
          <p className="text-[13px] text-slate md:text-[16px]">
            {departments.length} departments · {teacherTotal} teachers
          </p>
        </div>

        {departments.length === 0 ? (
          <div className="mt-8 md:mt-12">
            <EmptyState
              heading="No departments yet"
              message="Nothing has been imported yet. Check back later."
            />
          </div>
        ) : (
          <div className="mt-8 md:mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {departments.map((department) => (
              <DepartmentCard
                key={department.id}
                slug={department.slug}
                nameEn={department.nameEn}
                shortCode={department.shortCode}
                teacherCount={department.teacherCount}
              />
            ))}
          </div>
        )}
      </Container>
    </main>
  )
}
