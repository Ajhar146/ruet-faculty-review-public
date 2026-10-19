# Privacy Model & Trust Architecture

This document describes the privacy architecture, verification boundaries, and security guarantees of the RUET Faculty Review application.

---

## What This Repository Demonstrates

This public repository is published as a **source-available transparency snapshot** to provide inspectable evidence for the following core privacy properties:

1. **Decoupled Public Review Data:** Published review endpoints and client rendering payloads do not contain reviewer emails, student IDs, user account IDs, or linkable reviewer profile fields.
2. **Moderator Author Separation:** Administrative and moderator-facing review queues receive flattened, sanitized review representations that deliberately exclude the author's identity.
3. **Dedicated Privacy Core Boundary:** Anonymous review creation, duplicate submission enforcement, and subsequent review management operations (edit, delete, resubmit, appeal) interface through an isolated subsystem boundary.
4. **Local Device Recovery Material:** Review management credentials are held locally on the user's client device, preventing the production server from storing an ordinary relational foreign key between user accounts and submitted reviews.

---

## Published Review Data

When a review is published, public queries select only coarse evaluation metrics and timestamps:

```typescript
export interface PublicReview {
  id: string
  semester: string
  ratingOverall: number
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number
  comment: string | null
  createdAt: Date
}
```

- **Excluded from public views:** Reviewer email, account ID, department roll identifier, IP address, user-agent string, session token, and internal cryptographic identifiers.
- **Aggregations:** Per-teacher headline ratings average student ratings across courses without exposing student identities or individual reviewer grouping keys.

---

## Moderator-Facing Data

Moderators inspect submitted reviews to evaluate community standards (checking for abuse, profanity, harassment, or personal information leaks). The administrative DTO is explicitly flattened on the server before transmission:

```typescript
export interface QueueReview {
  id: string
  status: ReviewStatus
  semester: string
  comment: string | null
  reportCount: number
  createdAt: Date
  teacherName: string
  departmentCode: string
  courseCode: string
  courseName: string
  decision: ModerationDecision | null
  ruleFlags: string[]
  isOwn: boolean // Calculated server-side boolean; reviewer ID is discarded
}
```

- Moderators cannot inspect author email, student identity, or account records from the moderation interface.
- If an administrator submitted a review, `isOwn` informs them they cannot act on their own review, without exposing foreign keys.

---

## Privacy Core Boundary

Anonymous review lifecycle operations (submission preparation, duplicate prevention, and post-submission edits/deletes) cross an explicit privacy boundary:

```
[ Authenticated Student Context ]
                │
                ▼
   [ Coarse Public Review Action ]
                │
                ▼
┌───────────────────────────────────────────────┐
│              PRIVACY CORE                     │
│  (Proprietary Subsystem — Withheld)          │
│                                               │
│  • Enforces duplicate submission invariant    │
│  • Separates identity from stored review      │
│  • Validates reviewer management auth         │
└───────────────────────────────────────────────┘
```

The public contract (`public-contracts/privacy-core.ts`) defines the capabilities and security invariants of this layer while keeping proprietary cryptographic formulas and operational structures private.

---

## What Is Intentionally Withheld

To safeguard the live production system from circumvention, automated abuse, and reverse-engineering, several components are withheld:

- **Cryptographic Derivation Chains:** Proprietary algorithms and domain-specific constants used to generate anonymous ownership credentials.
- **Duplicate Prevention Internals:** Exact algorithms that enforce one-review-per-course invariants without linking accounts.
- **Production Database Schema & Migrations:** Internal table structures, column definitions, private indices, and migrations.
- **Production Secrets & Keys:** Domain separators, salts, HMAC keys, API credentials, and cloud connection parameters.
- **Automated Moderation Prompts & Rules:** Specific detection thresholds, banned-word lists, and heuristic scoring mechanisms.

---

## Infrastructure Limitations

Like all hosted web applications, client-server interactions involve lower-level infrastructure layers:

- **Network Observers:** Network transport encryption (TLS) protects payloads in transit, but network observers may observe request timing and packet sizes.
- **Hosting Provider Metadata:** Cloud hosting platforms (such as Vercel or Supabase) log HTTP request headers, source IP addresses, and invocation timestamps.
- **Timing Correlation:** A privileged infrastructure operator with access to simultaneously correlated application logs and database write timestamps could theoretically attempt traffic analysis.

---

## Data Retention Considerations

- **Published Reviews:** Retained indefinitely until updated or deleted by the author.
- **Soft Deletions:** When a student deletes their review, the review comment and ratings are cleared from public presentation. Internal soft-delete markers prevent duplicate-submission circumvention.
- **Account Data:** Student emails are verified solely to guarantee that reviewers are legitimate university members.

---

## What We Do NOT Claim

Trust requires strict honesty. We explicitly do **NOT** claim:

- ❌ "100% absolute untraceability against any adversary under all circumstances."
- ❌ "Cryptographically impossible for a rogue cloud infrastructure operator with server memory access to correlate requests."
- ❌ "Zero metadata exists across hosting provider access logs."
- ❌ "Formal Zero-Knowledge Proof (ZKP) protocol verification."

Instead, we provide a well-engineered application boundary where **ordinary application operations, database storage, public views, and administrative tools do not maintain or expose a direct link between reviewer identities and published feedback.**
