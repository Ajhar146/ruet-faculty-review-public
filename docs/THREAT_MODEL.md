# Threat Model & Adversary Analysis

This document outlines the threat model for the RUET Faculty Review system, detailing adversary capabilities, security scope, and trust boundaries.

---

## Adversary Matrix

| Adversary Profile | Description & Capabilities | Security Status | Architectural Mitigations |
| :--- | :--- | :--- | :--- |
| **Normal Site Visitors / Students** | Unauthenticated visitors or authenticated students inspecting public pages, network requests, and DOM payloads. | **IN SCOPE** | Public review endpoints serialize only coarse ratings and timestamps. Account emails, IDs, and session tokens are strictly omitted from public DTOs. |
| **Reviewed Faculty Members** | Teachers viewing public department and course pages to read feedback. | **IN SCOPE** | All reviews render uniformly as anonymous student contributions. Author identity is never included in the page markup, API responses, or meta tags. |
| **Application Moderators** | Trusted university members reviewing flagged reviews via administrative UI queues. | **IN SCOPE** | Moderator review views (`QueueReview`) deliberately exclude author identity, student email, and account relations. |
| **Database-Only Snapshot Attacker** | An adversary obtaining a static snapshot of the review tables without server application secrets or memory access. | **PARTIALLY ADDRESSED** | Review rows do not contain direct user account foreign keys. The privacy core subsystem separates ownership derivation from basic storage. |
| **Database Administrator (DBA)** | Privileged operator with ongoing read/write access to production database tables. | **PARTIALLY ADDRESSED** | Mitigated by architectural separation between account tables and review storage. Correlation may remain possible via temporal analysis of write spikes unless independent privacy-core key secrecy holds. |
| **Compromised User Device / Browser** | Malware, keylogger, or extension running inside the reviewer's local browser environment. | **OUT OF SCOPE** | An attacker controlling the client browser can observe the active Google session, entered review drafts, and locally stored recovery phrases. |
| **Network Observer (Passive/Active)** | An observer monitoring network traffic between the client and edge server. | **PARTIALLY ADDRESSED** | Encrypted via HTTPS / TLS 1.3. Passive metadata (packet sizes, exact request timestamps) remains observable at the transport layer. |
| **Cloud Hosting / Infrastructure Operator** | Privileged cloud operator (e.g. Vercel, server runtime host) with live container/process access. | **INFRASTRUCTURE-DEPENDENT** | Server runtime processes handle the active session during submission. Total untraceability against root-level hosting infrastructure is technically unattainable for hosted web apps. |

---

## Verifiable Public Invariants

The public source repository provides transparent proof of the following black-box properties:

1. **Public Serialization Guarantee:** The public review serializer (`PublicReview`) contains no author fields:
   $$\text{PublicReview} \cap \{\text{userId}, \text{userEmail}, \text{studentRoll}, \text{profileId}\} = \emptyset$$

2. **Moderator Queue Sanitization:** The moderator queue serializer (`QueueReview`) contains no author identifiers:
   $$\text{QueueReview} \cap \{\text{userId}, \text{userEmail}, \text{studentRoll}\} = \emptyset$$

3. **Anonymous UI Rendering:** Public templates label every review contribution anonymously without author attribution.

4. **Isolated Management Authorization:** Post-submission actions (edit, delete, resubmit, appeal) require valid presentation of reviewer-held authorization material through the Privacy Core interface.

---

## Technical & Physical Limitations

Public code inspection alone cannot guarantee protection against:
- **Server Access Log Analysis:** Correlating the IP address or exact timestamp of an incoming POST request with a database insert timestamp.
- **Client Fingerprinting:** Browser extensions or malware modifying client DOM before transmission.
- **Compromised OAuth Provider:** Google OAuth authentication assertions compromised at the identity provider level.

Users seeking maximum operational privacy are encouraged to use standard privacy-preserving practices (such as connecting via university campus Wi-Fi or privacy-focused networks).
