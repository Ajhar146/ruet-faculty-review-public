// Implementation withheld from the public repository.

import type { Role } from '@/lib/types'

export type EligibilityUser = {
    role: Role;
    departmentId: string | null;
    batchYear: number | null;
};

export type EligibilityResult = {
    ok: true;
    code: string;
} | {
    ok: false;
    error: string;
};

export type DepartmentReviewability = {
    ok: boolean;
    studentShortCode: string | null;
};

export async function canReviewDepartment(departmentId: string | null, teacherDeptShortCode: string): Promise<DepartmentReviewability> {
  throw new Error('Withheld from the public repository.')
}

export async function canReview(user: EligibilityUser, teacherId: string, courseCode: string, semester: string): Promise<EligibilityResult> {
  throw new Error('Withheld from the public repository.')
}
