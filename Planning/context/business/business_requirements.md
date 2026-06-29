# Materiabill — Business Requirements Document (BRD)

**Product:** Materiabill — construction project management & payments, built on the Inframodern platform
**Audience:** Product, business stakeholders, and the build team
**Status:** Requirements for v1, with roadmap to a contractor marketplace
**Scope of this document:** Self-contained business requirements — the _what_ and _why_. Technical design (data model, APIs, integration) is intentionally out of scope here and is documented separately.

---

## 1. Purpose

This document defines **what** Materiabill must do for its users and the business, and **why** —
independent of implementation. It is the source of truth for scope and acceptance. Technical
design (data model, APIs, integration) is documented separately and is out of scope here.

## 2. Product vision

Materiabill is the **client-first construction network**: a single platform where a contractor
runs their projects, their clients follow and pay, and their subcontractors deliver — with one
account per participant that spans every firm they work with. It pairs a premium, trustworthy
experience with deep commercial mechanics tuned for the region (cost-plus, retention,
pay-when-paid, multi-currency, bilingual EN/AR).

## 3. Problem statement

Construction relationships break down over money and trust:

- **Payment delays stall work.** Clients pay late; contractors stop; disputes follow, with no
  shared, neutral record of who did what when.
- **Fragmented tools.** A client working with several firms juggles several portals/logins;
  subcontractors juggle several main contractors. No one has a single view.
- **Opaque commercials.** Cost-plus, retention, variations, and disclosure are handled in
  spreadsheets and messages — error-prone and dispute-prone.
- **No portable reputation.** A contractor's track record (delivered on time, kept building
  through late payment, compliant) doesn't follow them; clients can't easily vet firms, and
  firms can't vet clients.

## 4. Business objectives

| #   | Objective                                                     | Why it matters                                    |
| --- | ------------------------------------------------------------- | ------------------------------------------------- |
| O1  | One account per participant across all counterparties         | Removes app-switching; creates the network effect |
| O2  | Make payment behaviour transparent and fair to both sides     | Reduces disputes; differentiates on trust         |
| O3  | Capture the full commercial agreement at project start        | Fewer disputes; correct billing; audit-ready      |
| O4  | Drive adoption through built-in invite/growth loops           | Each user pulls in their counterparties           |
| O5  | Establish portable reputation data from day one               | Enables a future ratings marketplace              |
| O6  | Deliver a premium, regionally-fit experience (EN/AR, SAR/EGP) | Wins a segment incumbents under-serve             |

## 5. Target users (personas)

- **Contractor (primary buyer)** — e.g. Essential Vision. Runs projects, money, materials,
  subs, approvals, documents, team. Wants control, fewer disputes, faster collection.
- **Client / owner** — e.g. Omar Khalil. Follows progress, approves, signs, pays. Wants
  clarity, one place for all their builds, and confidence the firm is acting in good faith.
- **Subcontractor** — e.g. Delta MEP. A contractor in their own right whose client is the main
  contractor; runs their package and gets paid. Wants visibility of progress and payment.
- **(Future) Marketplace participant** — any of the above discovering and rating others.

## 6. Market context (summary)

Incumbents (Procore, Buildertrend, Houzz Pro, CompanyCam, Fieldwire) are **single-contractor
silos**; none offer a cross-contractor client/sub network. Materiabill's wedge is the network +
premium UX + commercial depth, **not** out-feature-ing Procore. Position as _the client-first
construction network_.

## 7. Scope

**In scope (v1):** contractor admin (projects, money, materials/BOM, subcontractors, approvals,
documents, people & roles, branding, settings); client portal (network account, per-project
white-label, approvals, payments, continuity); onboarding for all actors; Inframodern login &
data sync; bilingual EN/AR, multi-currency SAR/EGP.

**Out of scope (v1), roadmapped:** public discovery directory & search, RFQ/tender/bidding, lead
matching, escrow/marketplace payments, native mobile field-capture app, WhatsApp notifications
(V1.5), accounting/ERP integrations beyond Inframodern.

---

## 8. Business requirements

Grouped by capability. Each is a business-level requirement (the system shall…).

### 8.1 Identity, access & network

- **BR-IA-1** Each participant (contractor org, client, subcontractor) has **one account**,
  identified by a verified email/phone, usable across every counterparty.
- **BR-IA-2** A client sees **all their projects across all contractors** in one place; a
  subcontractor sees **all their packages across all main contractors**.
- **BR-IA-3** **Strict isolation:** a contractor sees only their own relationship with a given
  client/sub; only the client sees their full cross-contractor picture. Private relationships
  must never leak.
- **BR-IA-4** Users sign in via **Inframodern** (no separate password for platform users).
- **BR-IA-5** **Invites & linking:** any party can invite a counterparty by email/phone; if an
  account already exists for that verified contact, the relationship **links** rather than
  creating a duplicate.
- **BR-IA-6** **Roles & permissions** are composed by each org from a platform permission
  catalog (no fixed roles), with EN/AR names; at least one member must always be able to
  manage roles.

### 8.2 Projects & agreements

- **BR-PR-1** A contractor can create a project capturing the **commercial model**: lump-sum,
  cost-plus, or remeasured.
- **BR-PR-2** The create flow captures **model-specific agreement terms**. For cost-plus: fee
  basis (% or fixed) and value, target/estimated cost, optional **GMP** with savings split,
  reimbursable cost categories, whether fee applies to subs/change-orders, client disclosure
  level, retention %, and billing cycle.
- **BR-PR-3** Agreement terms are the project's **commercial engine** — they govern BOM client
  visibility, budget, billing, and are rendered into a contract document at creation.
- **BR-PR-4** Commercial model/terms **lock** after the first client-visible financial record.
- **BR-PR-5** A project's client may be an **end-customer** or **another contractor** (when the
  org is acting as a subcontractor). Contractors can filter their portfolio by role
  (as main contractor vs. as subcontractor).
- **BR-PR-6** A client may create a **project stub** (self-serve) and invite a contractor to
  claim it.

### 8.3 Schedule

- **BR-SC-1** Projects have phases and milestones; completing a milestone can **unlock a linked
  client payment**.
- **BR-SC-2** A contractor proposes a timeline the client agrees to; the agreed timeline becomes
  an **immutable baseline** the forecast is measured against.
- **BR-SC-3** Moving a forecast date **requires a reason** that the client sees.

### 8.4 Money & payments

- **BR-MO-1** Track **money in** (client draws): expected → submitted → approved → released →
  received, with dates and references.
- **BR-MO-2** Track **money out** (subcontractor & supplier payables); money-out is **org-only**
  and never client-visible.
- **BR-MO-3** Apply **retention** (default 5%, per-project override) to payments, with
  released-at-handover/defects logic, in both directions of the chain.
- **BR-MO-4** **Pay-when-paid:** a sub payable linked to a client draw stays flagged until that
  draw is released.
- **BR-MO-5** **Multi-currency:** every amount carries a currency; portfolio rollups use synced
  exchange rates (SAR primary, EGP supported).
- **BR-MO-6** **Cost disclosure depth** to the client (category rollups vs. line-level) is
  configurable per org and per project.
- **BR-MO-7 — Payment continuity (goodwill / justified pause).** The system records, factually
  and **visible identically to both sides**, the gap between work built and cash collected, and
  whether the contractor **kept building through late payment** (goodwill) or **paused pending
  payment** (a documented contractual right). This protects the contractor in disputes either
  way and gently nudges the client to pay; it propagates down the subcontract chain.

### 8.5 Materials / BOM

- **BR-BM-1** Track materials per project and across the portfolio: sourcing, quantities
  ordered/used/remaining, delivery and install status, reorder.
- **BR-BM-2** Issuing a PO records provenance; receiving updates status; logging usage decrements
  remaining.
- **BR-BM-3** What the **client sees** of the BOM is governed by the project's disclosure depth.

### 8.6 Subcontractors (supply side)

- **BR-SB-1** A contractor can see **every subcontractor on a project**: trade/scope, package
  value, progress, paid/owed, retention, and whether they're on Materiabill.
- **BR-SB-2** Opening a subcontractor shows their **package file**: payment applications,
  submittals/RFIs awaiting the contractor, assigned snags, compliance (insurance, license,
  prequalification), and documents.
- **BR-SB-3** A subcontractor runs their package as a **project in their own workspace** with
  the main contractor as the client; the contractor's payable and the sub's incoming draw are
  the **same shared record** (recursion).
- **BR-SB-4** A contractor can **invite a subcontractor** (off-platform → onto Materiabill).

### 8.7 Quality & approvals

- **BR-QA-1** Manage **snags/punch list**; a snag **cannot be marked fixed without a fix photo**;
  only the client can close a snag they raised.
- **BR-QA-2** Manage **submittals and design packages** with revision history, and **variations /
  change orders** priced with cost and time impact (approved variations are immutable).
- **BR-QA-3** A unified **approvals/sign-offs** view shows what's awaiting the client vs. the team
  — the same record both sides see; reminders are logged in the trail.
- **BR-QA-4** Generate **certificates** (handover, sectional completion, payment) auto-filled from
  project data, with **multi-party signing, no fixed order**.

### 8.8 Documents & audit

- **BR-DC-1** Store project documents with **category and audience** (org / participants /
  client); site photos are first-class.
- **BR-DC-2** Every consequential action is recorded in an **append-only audit trail**
  ("logged in the trail").

### 8.9 Client experience

- **BR-CL-1** Clients get a **mobile-first portal**: a neutral "My projects" home, with each
  project view **skinned in that contractor's brand**.
- **BR-CL-2** Clients can approve, sign, comment, see their account, and view the **build
  continuity / goodwill** record, and pay.
- **BR-CL-3** Clients can **invite a contractor** (project-first), seeding the network cold.

### 8.10 Branding & white-label

- **BR-BR-1** Each contractor configures **accent colour, logo, and a custom domain** (with
  CNAME/SSL) that skins the **client's view of their projects** — branding applies at the
  **project** level, not the whole client app.
- **BR-BR-2** A removable "Secured by Materiabill" footer (plan-gated).

### 8.11 Onboarding & growth

- **BR-ON-1** Contractors onboard self-serve (marketplace install) or **pulled in by a client
  invite**.
- **BR-ON-2** Clients onboard via invite or **self-serve (project-first)**: sign up → add a
  project → invite the contractor.
- **BR-ON-3** First-session "aha": contractor = first project + client invited; client = sees a
  project and takes one action; key network metric = a client reaching a **second contractor**.

### 8.12 Settings

- **BR-ST-1** Org defaults: decision **grace window** (undo period, default 10 min), default
  retention, disclosure depth, notification channels, suggestion throttle — overridable per
  project where noted.

---

## 9. Non-functional requirements

- **NFR-1 Multi-tenancy & isolation** — strict per-workspace data isolation; cross-workspace
  visibility only via the network rules in §8.1.
- **NFR-2 Security & privacy** — server-side enforcement of all access/visibility rules; tokens
  never exposed to the browser; consent required before any data becomes shareable.
- **NFR-3 Internationalisation** — full EN/AR including right-to-left layout.
- **NFR-4 Mobile** — client and field experiences are mobile-first; field actions (updates,
  photos, material usage) are camera-first.
- **NFR-5 Auditability** — append-only trail for consequential actions; immutable records where
  specified.
- **NFR-6 Reliability of sync** — resilient consumption of Inframodern data (retry/outbox); never
  generate local IDs for synced entities.
- **NFR-7 Performance & responsiveness** — portfolio and project views remain responsive at
  realistic data volumes; graceful empty/loading/error states.
- **NFR-8 Accessibility** — sensible contrast, focus states, and keyboard support.

## 10. Success metrics (KPIs)

- **Adoption:** activated contractors; % of contractors who invite ≥1 client and ≥1 sub.
- **Network:** % of clients reaching a **second contractor**; invites sent per active user;
  invited-counterparty acceptance rate.
- **Engagement/value:** time-to-first-project; % of projects with agreed timeline baseline.
- **Trust/payments:** average days-late on client draws; disputes per project; goodwill events
  recorded.
- **Retention:** contractor and client D30/M3 retention.

## 11. Assumptions & dependencies

- **Inframodern** provides identity (OAuth), shared entities (users, brands, locations,
  customers, taxes, exchange-rates) via sync, app subscriptions, and billing primitives.
- The **InfraFinance / ShiftBill** pattern is the integration template.
- The construction domain (projects, money, materials, subs, etc.) is **Materiabill-owned**;
  Inframodern's core is largely unchanged (it does not need the food/catalog cluster).

## 12. Constraints

- Must run as an Inframodern satellite app (no separate identity system for platform users).
- Region/segment fit: EN/AR, SAR/EGP, cost-plus & remeasured contracts, retention,
  pay-when-paid.
- v1 builds on validated product designs; this BRD is the requirements source of truth.

## 13. Key risks

| Risk                                                          | Mitigation                                                                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-workspace client identity is a genuine platform concern | Decide between a **Materiabill-native client directory** and an **Inframodern customer projection** early; ship native for v1, keep the projection schema-ready |
| Field/mobile experience must rival CompanyCam/Fieldwire       | Invest real engineering in camera-first, offline-tolerant capture                                                                                               |
| Trust feature (goodwill) could be seen as one-sided           | Keep it strictly factual and even-handed; document the justified-pause case too                                                                                 |
| Privacy leakage across the network                            | Enforce isolation/consent server-side; only opt-in/aggregate data is shareable                                                                                  |

## 14. Roadmap (phasing)

1. **MVP** — auth + sync; projects + agreement terms; money (draws, payables, retention,
   pay-when-paid, continuity); materials; client portal with approvals/payments; onboarding.
2. **V1** — subcontractors/recursion; submittals/design/variations; certificates & e-sign;
   roles/branding/white-label; full EN/AR + RTL; notifications.
3. **Later** — native mobile field capture; reporting/exports; WhatsApp; accounting export.
4. **Marketplace (future, design-for-now)** — org profiles, engagement-scoped reviews/ratings,
   portable reputation; then discovery, RFQ/bidding, matching.

## 15. Open business decisions

- **Client identity model** — **Materiabill-native client directory** vs **Inframodern
  customer projection** (shared in Inframodern core).
  _Recommendation: Materiabill-native for v1, projection schema-ready._
  (Options are named, not lettered: the web spec and integration doc previously used
  "Option A/B" with the letters swapped relative to this list.)
- **Participant-org model** — subs/consultants as Inframodern guest orgs vs Materiabill-local.
- **Stub ownership** — client-originated projects: ownership transfers to the contractor on claim.
- **Billing model** — is Materiabill itself billable on Inframodern (plans/prices/features)?

## 16. Glossary

- **Draw** — a client payment milestone (money in).
- **Payable** — money the contractor owes a sub/supplier (money out, org-only).
- **Retention** — a % withheld from each payment, released at completion/defects period.
- **Pay-when-paid** — a sub payment contingent on the contractor being paid by the owner.
- **GMP** — Guaranteed Maximum Price; a cost cap with a savings split if under-run.
- **Continuity / goodwill** — the factual built-vs-collected record showing whether work
  continued through late payment or paused.
- **Recursion** — every org is a contractor in its own workspace; a subcontractor's client is the
  main contractor.
- **Shared edge** — one org's payable equals the counterparty's draw — the same record both sides.
