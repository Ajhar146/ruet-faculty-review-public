# Public Release Scope & Manifest

This document outlines the scope of the RUET Faculty Review source-available transparency repository, listing what is published for public inspection versus what is intentionally omitted.

---

## Included in Public Release

The following components are published to enable public verification of application behavior, user-facing interfaces, and privacy boundaries:

- **Public Application UI & Views:**
  - Teacher and faculty directory browsing
  - Departmental course listings and curriculum views
  - Public review presentation and rating display components
  - Review authoring and editing form interfaces
  - Client-side recovery phrase gate modal

- **Authentication & Security Controls:**
  - University domain email verification logic
  - Session authorization checks and role-based guards
  - Security headers, Content Security Policy (CSP) nonce generation, and proxy validation
  - Request rate-limiting interfaces and abuse guards

- **Public Data Transfer Objects (DTOs) & Contracts:**
  - Handcrafted public review projection (`PublicReview`)
  - Sanitized moderator queue projection (`QueueReview`)
  - Public persistence repository contracts (`PublicReviewRepository`, `ModeratorReviewRepository`)
  - Narrow Privacy Core interface definition (`PrivacyCore`)

- **Transparency Documentation & Models:**
  - Conceptual transparency data model (`docs/erd.png`)
  - Privacy guarantees and boundaries (`docs/PRIVACY_MODEL.md`)
  - Adversary classification and limits (`docs/THREAT_MODEL.md`)

---

## Intentionally Omitted from Public Release

The following components are proprietary or sensitive and are withheld from this repository:

- **Proprietary Privacy Core Implementation:**
  - Cryptographic derivation formulas for anonymous review ownership
  - Duplicate-submission prevention algorithms
  - Deterministic lookup constructions and salt/pepper parameters
  - Reviewer authorization verification mechanisms

- **Production Database Internals:**
  - Real database schema and Prisma schema files
  - Database migration histories and SQL scripts
  - Internal table and column identifiers for privacy storage
  - Seed datasets and operational database dumps

- **Deployment Secrets & Operational Infrastructure:**
  - Production environment credentials, API keys, and connection strings
  - Operational maintenance scripts (backups, imports, database resets)
  - Internal scraping tooling and automated data synchronization pipelines
  - Cloud hosting configuration IDs and private notification webhooks

- **Proprietary Moderation Assets:**
  - System prompts and scoring thresholds for automated AI moderation
  - Comprehensive banned-word dictionaries and evasion detection heuristics
