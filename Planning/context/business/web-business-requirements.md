# Materiabill — Web Application Business Requirements

> **App:** Contractor admin web application (React + Vite, "Settled" design system)
> **Actors:** Contractors, their team members, and (indirectly) subcontractors
> **Platform:** Inframodern satellite app — OAuth for identity, RabbitMQ for entity sync

---

## 1. Authentication & Access

- Login is exclusively via **Inframodern OAuth** (authorization_code + refresh_token). No local credentials.
- Access is gated by three conditions: app installed in workspace **AND** active subscription **AND** user is a workspace admin or an allowed user.
- Tokens stay server-side in an encrypted session; the browser only holds a session cookie — tokens are never exposed to the client.
- `GET /auth/callback/inframodern` sets the session; `POST /auth/logout` clears it; `GET /user` rehydrates it.
- **Sandbox mode:** uses a designated Inframodern sandbox OAuth app — no real credentials. The OAuth redirect targets the sandbox app's `/authorize` endpoint, which accepts any input and issues a test token. No local credential path exists.
- **Signup — Step 1:** Initiates the Inframodern OAuth flow (`GET /auth/begin`). Company name and work email are pre-filled from the returned OAuth token claims. No password is collected or stored by Materiabill.
- **Signup — Step 2:** Accent colour picker with a **live client portal preview** rendering an "Approve" button in the chosen colour. Submitting creates the workspace with `mode = empty`, the selected accent colour, and the workspace's default `Brand` record. See §22 for the Brand entity model.
- **Post-signup done screen:** 4-item onboarding checklist — ☐ Create your first project, ☐ Invite your client (completion-driven — unchecked at creation, checked only when each action is actually completed), then Set the timeline and Upload the contract (interactive CTAs).
  - **Activation metric (BR-ON-3):** the contractor's 'aha' is defined as completing the first project creation and sending the first client invite. The checklist items above are designed to drive this — the done screen should not dismiss as complete until both are checked.
- All protected routes have route guards enforcing authentication.

---

## 1a. Navigation & Global Chrome

### Global Search

- Activated by **Cmd/Ctrl + K** or the search icon in the top navigation bar.
- Indexes **Projects**, **Materials**, **People**, and **Documents** across the workspace.
- **"People" search scope** includes: workspace members (name + email), project participants (name + role on the project), `ClientIdentity` records (client name + verified contact), and subcontractor org names.
- Results grouped by entity type; **maximum 12 results** shown (capped per group if multiple entity types match).
- `Escape` closes the search overlay.

### Notifications Panel

- Bell icon in the top navigation bar with an **unread count badge**.
- Slide-in panel listing per-event notifications: draw approved/released, snag opened/fixed/closed, variation submitted/approved, document signed, invite accepted/declined.
- **"Mark all read"** action clears the badge count.

### Workspace Switcher

- One user identity can hold roles across **multiple workspaces** (e.g., main contractor in Workspace A and subcontractor in Workspace B).
- Workspace switcher accessible from the navigation bar; switching re-scopes all data to the selected workspace.
- Active workspace name always visible in the nav bar.

### Activity / Audit Trail Panel

- Every major action generates an **immutable, append-only** audit entry labeled **"internal"** or **"client"** based on the audience of the triggering action: `audience = org` → **"internal"**; `audience = participants` or `audience = client` → **"client"**.
- Panel shows up to 16 most-recent trail entries; full log accessible via dedicated screen.
- Trail entries cannot be edited or deleted.

### Toast & Undo System

- **Simple toast** (2.8 s auto-dismiss): used for non-reversible confirmations.
- **Undoable toast** (5.2 s): displayed as **"Undo · [N]m"** for any action still within the grace window. Clicking "Undo" reverts the action and shows a brief "Reverted" simple toast.
- After the grace window elapses, the toast auto-dismisses and the decision commits — notifications fan out.

### Pending Decisions Panel

- A **clock icon** in the nav bar (distinct from the notifications bell) shows an active badge while any action is still within its grace window.
- Clicking opens a slide-in "Pending Decisions" panel listing every in-window action with: record type, summary label, a per-action countdown (minutes and seconds remaining), and an **"Undo"** button.
- Clicking "Undo" in the panel triggers the same revert logic as the undoable toast and shows a "Reverted" simple toast.
- When the grace window expires the entry is removed from the panel and the decision commits.
- This is the **second undo surface** — accessible for the full duration of the grace window after the 5.2 s toast has dismissed.

### Supporting UI Patterns

- **Confirm dialog:** title + message + Cancel + destructive action button; used for irreversible actions outside the grace-window undo mechanism.
- **Site map overlay:** modal showing the project's site location on a map; triggered from the project list row and from the project header.
- **Photo lightbox:** full-screen overlay for any photo thumbnail; Prev / Next arrows, current index label (e.g. "3 / 8"), wraps around at the ends.
- **`Escape`** closes any open overlay, panel, or modal.

---

## 2. Portfolio Overview (Cross-Project Home)

- Top-level screen spanning **all projects** in the contractor's workspace.
- Displays a **"Needs you"** summary: action items awaiting the contractor across all projects.
- Displays a **"Needs client"** summary: items currently waiting on clients across all projects.
- Shows a **portfolio cash position** (money in vs money out aggregated across all projects).
- Shows a **monthly cash-flow chart** across projects.
- Shows a **per-project financial breakdown** table.
- Money-out (payables) is visible at org level only — never shown to clients, even at portfolio level.
- **Empty state** shown for brand-new organisations with no projects yet.
- Multi-currency: portfolio rollups convert currencies using synced exchange rates from Inframodern.

### Portfolio-Level Stat Tiles

| Tile                 | What it shows                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Needs client**     | Count of items across all projects currently waiting on a client action                                                 |
| **Pending payments** | Count of approved draws not yet released (money the client has approved but the contractor has not yet marked received) |
| **Needs your team**  | Count of items across all projects waiting on the contractor's team                                                     |
| **Forecasts stale**  | Count of projects whose forecast delivery date has not been updated past a threshold period                             |

- Each stat tile is clickable — tapping opens the full list of qualifying records.
- **Project status badge colour coding:** On plan → green · Behind → amber · Stale → red.
- Each project card shows its **"now"** field (free-text current phase/activity) and **"bottleneck"** field (free-text current blocker) — optional contractor-entered fields updated to reflect the site reality.

---

## 3. Project List & Filtering

- Lists all projects in the workspace.
- Filter projects by: **city**, **project manager (PM)**, **status** (On plan / Behind / Stale), and **role** (as main contractor vs as subcontract).
- Subcontract projects appear with a distinct visual indicator.
- Strict workspace isolation: a contractor sees only their own projects and relationships.
- Each project row shows a **status badge** colour-coded: On plan → green, Behind → amber, Stale → red.
- Each project row shows the **"now"** field (current phase/activity) and **"bottleneck"** field (current blocker).
- A **map icon** per row opens the site location map overlay for that project.

---

## 4. Create Project — Model-Aware 4-Step Wizard

### Steps

1. **Basics:** project name, city, currency, delivery date, PM assignment, brand, geo coordinates, client (by `endCustomerId` or `clientOrgId`).
   - **Two client-type variants:** the client field accepts either an `endCustomerId` (a `ClientIdentity` — an individual end-customer) or a `clientOrgId` (a peer contractor workspace whose project this org is delivering as a subcontractor). The wizard search scope, field label, and downstream display differ: when `clientOrgId` is set, the project dashboard shows a **subcontract banner** (§5) and the project appears in the "as subcontract" filter in the project list (§3).
2. **Model:** select the commercial model — Lump-sum, Cost-plus, or Remeasured.
3. **Terms (model-aware):** captures only the fields applicable to the chosen model. The wizard shows and requires fields according to this mapping:

   | Field                              |  Lump-sum  |              Cost-plus               | Remeasured |
   | ---------------------------------- | :--------: | :----------------------------------: | :--------: |
   | Fee basis (% or fixed)             |     —      |              ✓ required              | ✓ required |
   | Target cost                        |     —      |               optional               |     —      |
   | GMP ceiling (Cost-plus sub-option) |     —      |               optional               |     —      |
   | Savings split                      |     —      | optional (required when GMP enabled) |     —      |
   | Reimbursable categories            |     —      |              ✓ required              |     —      |
   | Fee-on-subs flag                   |     —      |               optional               |     —      |
   | Disclosure depth                   | ✓ required |              ✓ required              | ✓ required |
   | Retention percentage (default: 5%) | ✓ required |              ✓ required              | ✓ required |
   | Billing cycle                      | ✓ required |              ✓ required              | ✓ required |

   Fields marked "—" are not applicable for that model and are not stored on the `AgreementTerms` record.

   **Cost-plus GMP sub-option:** when GMP is enabled on a Cost-plus project, a Guaranteed Maximum Price ceiling is set on the total cost. Any savings below the GMP are split between contractor and client per the configured split ratio. GMP is a sub-option of the Cost-plus model, not a standalone commercial model — it is only available when Cost-plus is selected.

4. **Review:** confirm all details before creating the project.

### On Creation

- `AgreementTerms` are stored on the project.
- A **contract Document is auto-generated** from the agreed terms.
- `baselineDeliveryDate` is set and becomes **immutable** after this point.
- The app immediately navigates to the new project's **Setup tab**.

### Business Rules

- `baselineDeliveryDate` is immutable once set — no silent edits.
- Commercial model and terms **lock** when the first `DrawItem` transitions from Pending to Approved status — the client's first approval of a draw is the unambiguous "first client-visible financial record" trigger.
- Terms govern BOM client-visibility via `disclosureDepth`.

---

## 5. Project Dashboard Tab

- Displays project vitals: name, status, progress percentage, delivery date vs baseline.
- Shows **"Needs you"** items for the contractor on this project.
- Shows **"Needs client"** items pending from the client.
- Shows a **settlement snapshot**: cash position for this project.
- Shows a **cash-flow chart**.
- Shows a **schedule summary** (current vs baseline).
- Shows **latest feed activity**.
- Displays a **subcontract banner** when the project's client is another workspace (`clientOrgId` is set).

### Project Header (Persistent Across All Tabs)

- Project name, city, status badge, PM name, breadcrumb back to projects list.
- **"Needs you"** and **"With client"** action buttons with live badge counts always visible.
- **"Map"** button opens the site location map overlay.
- **4 always-visible stat cards:** Progress %, Schedule status, Budget committed, Retention held.
- **Tab bar** shows hot-count badges on **Money**, **Snags**, **Materials**, and **Subcontractors** tabs (live pending/unresolved counts).

### Settlement Bar

- Three horizontal segments summing to the contract value:
  - **Received** — sum of Released draws (Released is the terminal state; "released" means the contractor has received payment and the pay-when-paid flag clears on linked sub payables).
  - **In motion** — sum of Approved draws not yet released (client has approved, payment is confirmed but not yet marked received by the contractor).
  - **Remaining** — contract value minus Received minus In motion (not yet billed or pending).
- **"% collected vs % built"** comparison shown: Released-to-date ÷ contract value vs build progress % — highlights underbilling or overbilling at a glance.

### Need Detail Panel

- Clicking any "Needs you" or "Needs client" lane item opens a **slide-in detail panel** (no page navigation).
- Panel contains: record type label, key fields, contextual description, and **footer action buttons** specific to the record type (approve, sign, reject, etc.).

---

## 6. Schedule & Timeline Tab

- Define and manage **project phases** and **milestones** within phases.
- **Milestone completion unlocks linked draw items** — a milestone must be marked complete before its associated draws can be released.
- The client-agreed **baseline timeline** is displayed alongside the current forecast as an immutable reference.
- Moving a forecast date requires the contractor to enter a **client-visible reason** — this is a reason-required action.
- Agreed timeline baseline is append-only; no silent backdating or edits.
- **Baseline agreement flow:** the contractor proposes a timeline; the client approves it via a sign-off action (surfaced in the client portal's "Needs you" list as "Approve timeline"). The baseline is in a draft/proposed state and remains editable by the contractor until the client approves. Once approved, the baseline delivery date is locked and immutable — the approval is a `SignOff` record. If the client never explicitly approves (e.g. for a project with no client portal access), the contractor can self-certify the baseline as agreed via a manual "Lock baseline" action.

---

## 7. Money Tab — Draws (Money In)

- Lists all draw items for the project.
- **DrawItem fields:** amount, currency, status, expected date, released date, retention amount.
- **Draw status values:** Pending → Approved → Released.
  - **State mapping from BRD:** the BRD defines 5 states (expected → submitted → approved → released → received). In this spec: **Pending** = submitted (contractor has raised the request); **Released** is the terminal state collapsing "released" and "received" — the contractor marks Released after receiving payment. Planned future draws not yet submitted are not persisted as DrawItem records; they are represented as forecast fields on the project.
- **Retention release:** retained amounts are released by a dedicated contractor action (`POST .../draws/release-retention`) tied to the handover certificate event. Partial release (e.g., practical completion tranche vs. defects period tranche) is configurable per project terms. Releasing retention creates an audit entry and updates the settlement bar.
- Contractor **submits/creates a draw request** (`POST .../draws`). Draws start as Pending.
- **Client approves a draw** (`POST .../draws/:id/approve`) — this endpoint is client-facing and must not be authorised for contractor sessions. Approval moves the draw to Approved.
- Contractor **releases a draw** (`POST .../draws/:id/release`) after receiving payment — moves to Released and clears the pay-when-paid flag on all linked sub payables.
- Retention amount is tracked per draw.
- Approved draws feed into the project's continuity/goodwill record.
- Every amount must carry an explicit currency.

---

## 8. Money Tab — Payables (Money Out)

- Lists all outgoing payables (payments to subcontractors and suppliers).
- **Payable fields:** payee type, amount, terms, due date, status, `payWhenPaidDrawItemId`, retention amount.
- Contractor can **mark a payable as paid** (`POST .../payables/:id/pay`).
- **Pay-when-paid flag:** a sub payable linked to a client draw item stays flagged until that draw is released.
- **Retention release on payables:** sub payable retention is released in parallel with the main contractor's retention release, propagated via `PaymentEdge`. The sub's incoming draw retention clears when the contractor triggers retention release on their side.
- Money-out is **org-only** — never visible to clients under any circumstances.
- Every amount must carry an explicit currency.

---

## 9. Money Tab — Continuity / Goodwill Record

- Tracks the **payment continuity record** per project: built vs collected, days carried, status.
- **Status values:**
  - `on_track` — payments up to date.
  - `carrying` — contractor continued working despite late payment (goodwill). Set automatically when an expected draw date passes without reaching Released status.
  - `paused` — contractor paused work; justified contractual stop due to non-payment. Set via explicit contractor action `POST /continuity/:projectId/pause` (reason required). Propagates down the subcontract chain via `PaymentEdge`.
- `GET /continuity/:projectId` returns the built-vs-collected view and goodwill status.
- The record **propagates down the subcontract chain** via `PaymentEdge`: if the main contractor is unpaid and pauses, the subcontractor's record reflects it.
- Both contractor and client see the **same status and goodwill period**, but the client-facing response omits the underlying payable amounts and sub-payment details that drive the status — preserving the money-out hidden rule. Only status label, goodwill start date, and days carried are exposed to the client.
- **Upstream propagation visibility:** when this workspace is acting as a subcontractor (`clientOrgId` is set) and the upstream main contractor is carrying or paused, this project's continuity tab displays an upstream-triggered note ("Carrying — upstream payment delay") alongside the local record. The contractor can see the upstream state but cannot modify it; only the upstream relationship resolves it.
- This record is the factual foundation for future marketplace reputation features.

---

## 10. Money Tab — Budget Lines

- Manages the project budget broken down by category.
- **BudgetLine fields:** category, budget amount, actual amount, audience.
- Audience controls visibility: `org | participants | client`. For budget lines, `participants` shows only the category total (same as category-rollup disclosure depth) — individual cost lines are never exposed to participants. Only `audience = client` with `disclosureDepth = line-level` exposes individual line amounts.
- Actual amounts are updated as materials and payables are recorded.
- **Cost-plus disclosure depth** governs which budget lines are client-visible:
  - Line-level: client sees individual cost lines.
  - Category rollup: client sees only category totals.
- Disclosure depth is set at org default level and can be overridden per project.

---

## 11. Materials / BOM Tab

- Cross-project and per-project **Bill of Materials (BOM)** register.
- **Material fields:** code, status, unit price, qty ordered, `qty_received`, qty used.
  - `qty_received` is a scalar field on the Material record, accumulated by `POST .../materials/receive` calls.
- **PurchaseOrder:** linked to materials, tracks provenance.
- **MaterialUsage:** usage log entries per material.
- Actions: register new materials, receive deliveries (update `qty_received`), log usage, issue purchase orders.
- **BOM client-disclosure matrix** (governed by `AgreementTerms.disclosureDepth`):

  | Disclosure level    | Client can see                                                               |
  | ------------------- | ---------------------------------------------------------------------------- |
  | **None**            | No BOM data — disclosure banner hidden                                       |
  | **Category rollup** | Category name and total cost per category only; no individual line detail    |
  | **Line-level**      | Individual material rows: code, description, unit price, qty ordered, status |

- A **client-disclosure banner** at the top of the BOM tab indicates the current disclosure level applied to this project. The banner is contractor-facing only — the client sees the disclosed data, not a banner explaining the disclosure level.
- Material usage log is **append-only** for audit purposes.
- **Material code:** auto-assigned at creation in format **MAT-{n}** (sequential per workspace).
- **Material status values and transition triggers:**
  - `Ordered` — initial status on creation.
  - `In transit` — set manually by the contractor (or PM) when goods are confirmed dispatched; no automatic trigger.
  - `Delivered` — set automatically when `POST .../materials/receive` is called (first delivery receipt).
  - `Installed` — set automatically when `POST .../materials/use` records usage that meets or exceeds `qty_received`.
  - Materials may skip `In transit` (local pickup) — transition directly from `Ordered` to `Delivered` via `POST .../materials/receive`.
- **Calculated fields:** Used % = (qty used ÷ qty ordered) × 100; Remaining = qty ordered − qty used.
- **Client suggestion:** a `ClientSuggestion` is a client-initiated note attached to a specific material item, used to request a substitution or flag a concern. Fields: `materialId`, `text`, `status` (Open · Resolved · Dismissed). The contractor acknowledges or resolves it; the suggestion is client-visible. The suggestion throttle (see §23) caps the number of Open suggestions per material item.
- **Suggestion throttle:** org-level setting caps the number of open `ClientSuggestion` records per material item (configurable in Workspace Settings).
- **Endpoints:**
  - `POST .../materials` — create material
  - `POST .../materials/receive` — record delivery; increments `qty_received`, sets status to `Delivered`
  - `POST .../materials/use` — log usage; sets status to `Installed` when `qty_used >= qty_received`
  - `POST .../materials/:id/suggestions` — client creates a suggestion
  - `POST .../materials/:id/suggestions/:sid/resolve` — contractor resolves a suggestion

---

## 12. Subcontractors Tab

- Lists all subcontractors for the project, grouped by trade.
- Per-subcontractor: package summary, progress percentage, amount paid vs amount owed.
- Shows **on-platform vs off-platform** indicator per sub.
- Clicking through opens a **read-only embedded view** of the sub's package file, scoped to the shared project boundary defined by the `PaymentEdge`. The contractor's session identity does not change. This is the same mechanism described in §24 — see §24 for the full access model.
- **Invite subcontractors** by verified email or phone.
- Sub payables are linked to client draws via **pay-when-paid**.
- When a sub is on-platform, a `PaymentEdge` joins the contractor's payable to the sub's incoming draw — they are one shared financial edge.

### Compliance Badges

Each subcontractor entry displays compliance status badges:

| Badge            | Values                    |
| ---------------- | ------------------------- |
| Insurance        | Valid · Expired · Missing |
| Trade licence    | Valid · Expired · Missing |
| Prequalification | Valid · Expired · Missing |

Expired or missing badges are highlighted as a visual warning to the contractor.

### Business Rules

- A subcontractor runs their package as a **full project in their own workspace**, with the main contractor as their client. This is recursive.
- Pay-when-paid and goodwill/continuity **propagate along** `PaymentEdge` down the chain.
- The contractor sees only their own relationship with each sub — strict isolation.

---

## 13. Submittals & Design Tab

- Create and track **Submittals (SUB)** with full revision history.
- Create and track **Design/Shop Drawing Packages (DSN)** with revision history.
- Create and track **Variations (V)** — priced changes to the contract. Approving a variation increases the project's contract value: `contractValue = baselineContractValue + Σ(approved variation amounts)`. The settlement bar denominator updates accordingly. A new version of the auto-generated contract Document is created on approval.
- Revision history is preserved; earlier revisions cannot be deleted.
- **Approved variations are immutable** — append-only once approved.
- **Submittal code:** auto-assigned at creation in format **SUB-{n}** (sequential per project).
- **Status values — Submittal:** Pending → Under review → Approved (or Rejected).
- **Status values — Design package:** Draft → Issued → Approved. "Issue Rev 0" is the action label for the first issue; "Rev 0" is display context only — the persisted enum value is `Issued`. Re-issues (Rev 1, Rev 2, …) create new revision records; each has its own `revisionNumber` (0-based) and `status = Issued`.
- **Status values — Variation:** Pending → Approved (or Rejected). Approved variations lock price and scope change.
- **Milestones** are owned by the Schedule module (§6). Completing a milestone (via §6) unlocks any linked draw items. See §6 for milestone status values and management.

---

## 14. Snags (Punch List) Tab

- Create snag items with area and description.
- **Snag fields:** area, status, fix photo ID (mandatory to fix), audience, raised by.
- **Assign snags** to team members (`POST .../snags/:id/assign`). Assigning a snag automatically transitions its status from Open to In progress as a side effect.
- **Fix a snag** requires uploading a fix photo — enforced server-side (`POST .../snags/:id/fix`). Moves status to Fixed.
- Audience controls visibility: org | participants | client.
- **Only the client can close a snag** — team members can fix but cannot close (`POST .../snags/:id/close` is client-only).
- **Admin override:** a workspace member with the `manage_snags` permission can close a snag on behalf of the client if (a) the client account has been deleted, or (b) the snag has been in Fixed status for 30 or more days with no client action. Override closure creates an audit entry labeled "internal" with the reason.
- Fix photo is mandatory; the endpoint rejects fix requests without a photo.
- **Snag status values:** Open → In progress → Fixed → Closed.
- **Automatic audience rule:** if "QC" appears in the snag name, the snag defaults to `audience = org` (internal); all other snags default to `audience = client`.

---

## 15. Docs Tab — Project Documents & Certificates

- The **auto-generated contract document** is created at project creation, reflecting the agreed `AgreementTerms`.
- **Certificate types:** handover, completion, payment. Each auto-fills from project data as follows:

  | Field                                     | Handover | Completion | Payment |
  | ----------------------------------------- | -------- | ---------- | ------- |
  | Project name                              | ✓        | ✓          | ✓       |
  | Client name                               | ✓        | ✓          | ✓       |
  | Contractor name                           | ✓        | ✓          | ✓       |
  | Contract value (current, post-variations) | ✓        | ✓          | ✓       |
  | Practical completion date                 | ✓        | ✓          | —       |
  | Defects liability period                  | ✓        | —          | —       |
  | Draw reference (amount + draw number)     | —        | —          | ✓       |
  | Retention amount                          | —        | ✓          | ✓       |
  | Date of issue                             | ✓        | ✓          | ✓       |

- Document categories with audience control (org | participants | client).
- **Multi-party signing** for documents — no fixed signing order; any signatory can sign in any sequence.
- Signatory management: signatories may be added or removed only while the document is in **Draft** status. Once the first signature is applied (document moves to Out for signature), the signatory list is locked — no additions or removals until the document is Executed or explicitly voided.
- **Voiding a document:** a document may be voided from **Draft** or **Out for signature** status only. Once Executed, a document cannot be voided. Voiding requires the `manage_documents` permission. Voiding a document in Out for signature status notifies all signatories that the signing process has been cancelled. Voiding creates an immutable audit entry. A voided document may be recreated as a new Draft.
- Site photos are stored as Document records. On the web app, site photos are uploaded via file picker (JPEG, PNG, max 10 MB); field camera capture is mobile-first. Required metadata on upload: project, category (defaults to `site-photo`), and audience. Photos may be associated with a snag (`snagId`) or a feed post (`feedPostId`); unattached photos appear in the Documents tab filtered by category.
- **Executed certificates are immutable** — append-only once signed.
- **Document / certificate status values:** Draft → Out for signature → Executed.

---

## 16. Project Setup Tab

- Configure the project's commercial engine via **AgreementTerms** (see project creation for all fields).
- Manage **participants**: team members assigned to this project.
- **Invite a client** by email or phone (creates a `ClientIdentity`).
- **Invite a subcontractor org** (creates a `ContractorInvite`).
- Invite endpoint: `POST /invites` — links by verified email/phone only.
- `AgreementTerms` **lock** when the first `DrawItem` transitions from Pending to Approved — the client's first draw approval is the definitive "first client-visible financial record" trigger. At v1, variation approval and other financial records do not trigger this lock — only DrawItem Pending → Approved.

### Invite Modal — Three Variants

| Variant               | Triggered when              | Required fields                         |
| --------------------- | --------------------------- | --------------------------------------- |
| **Team member**       | Inviting a workspace member | Email/phone + Role                      |
| **Subcontractor org** | Inviting a sub firm         | Email/phone + Org type + Package scopes |
| **Client**            | Inviting a project client   | Email/phone + Client access level       |

### Invite Variant B — Client-Initiated

- A client can add a project **stub** and invite a contractor by firm name — the contractor's inbox receives an invite to claim the stub.
- Once the contractor claims the stub, they build the project out; the client is **automatically attached** without a separate client invite step.
- The client's stub card upgrades: "Awaiting contractor" → "Invited" → live project card as each stage completes.

### Contractor Claim Screen (Invite Variant B)

When a stub invite arrives in the contractor's notification inbox:

- The contractor sees a **"Claim project"** panel pre-filled with the client's stub data: project name, description, scope notes, and location.
- The contractor must complete: commercial model selection, AgreementTerms fields (per §4 Step 2–3), and confirm the client identity (auto-resolved from the stub's `originatedBy`).
- On submission the stub converts to a full project in the contractor's workspace; `originatedBy` is preserved for attribution.
- The client is automatically attached; the client's stub card upgrades to a live project card without a separate client invite.

### Business Rules (Invite Flow)

- **Link-vs-create on invite:** `POST /invites` first checks for an existing `ClientIdentity` or Inframodern account matching the provided verified email/phone. If found, the system **links** the new project relationship to the existing identity rather than creating a duplicate account. The invitee receives a project-access notification, not a new-account invite.
- **Per-project grace window override:** the grace window duration can be overridden per project under a "Project Settings" sub-section in the Setup Tab. Default is the org-level setting (§23). Changes take effect for new decisions on that project; in-flight pending decisions retain their original window duration.

### 48-Hour Contractor Invite Auto-Nudge (Invite Variant B only)

- This nudge applies **only to Invite Variant B** (client-initiated stub): if the invited contractor does not claim the client's project stub within 48 hours, the system sends an automatic reminder to **the contractor** (in-app notification + email).
- The client may see an updated status on their stub card ("Nudged") indicating the reminder was sent.
- The nudge window is configurable in Workspace Settings (see §23).
- When the contractor invites the client (standard Team/Client invite flow): no automatic nudge is sent by default. A separate follow-up mechanism may be added in a future version.

---

## 17. Portfolio-Level Payments Screen

- Aggregated financial view across **all projects**.
- Shows **portfolio cash position** (money in vs money out across all projects, multi-currency converted).
- Shows a **monthly cash-flow chart** across projects.
- Shows a **per-project financial summary**.
- Money-out (payables) shown at org level only.
- Multi-currency: uses synced exchange rates for currency conversion.

### Portfolio Payment Stat Tiles

| Tile               | Definition                                                    |
| ------------------ | ------------------------------------------------------------- |
| **Expected in**    | Sum of approved draws not yet released, across all projects   |
| **Owed subs**      | Sum of sub payables pending payment, across all projects      |
| **Owed suppliers** | Sum of supplier payables pending payment, across all projects |
| **Net position**   | Expected in − Owed subs − Owed suppliers                      |

Net position gives the contractor their real free-cash forecast at portfolio level.

---

## 18. Portfolio-Level Approvals Screen

- Cross-project view of all **pending and completed sign-off actions**.
- Shows "Needs you" and "Needs client" items across all projects.
- Contractor can respond to sign-off requests (approve / reject / sign) from this screen.
- Badge count on the portfolio approvals screen showing pending items.
- **Grace window** before a decision commits and notifications fan out (default: 10 minutes).
- **Reminders:** the contractor can trigger a **manual reminder** to the client for any pending sign-off item (button on each pending row). Each reminder is recorded as an immutable audit trail entry (labeled `client`) with the timestamp and the identity of the sender. Automatic scheduled reminders (e.g. after 48 h of inactivity on a pending item) are a **v1.5 feature** — manual reminders are available at launch.

---

## 19. Portfolio-Level Materials / BOM Screen

- Cross-project **BOM register** showing materials across all projects.
- Provides a portfolio-wide view of materials status, quantities, and usage.

### Portfolio Materials Stat Tiles

| Tile                        | Definition                                                       |
| --------------------------- | ---------------------------------------------------------------- |
| **Materials tracked**       | Total count of material records across all projects              |
| **Awaiting client**         | Count of material items with open client suggestions             |
| **In transit**              | Count of material items in "In transit" status                   |
| **Delivered / installed %** | Percentage of tracked materials in Delivered or Installed status |

---

## 20. Portfolio-Level Documents & Certificates Screen

- Cross-project document view showing **certificates** (handover, completion, payment) and project documents.
- Certificate builder with multi-party signing.
- Document audience rules apply: org | participants | client.

### Portfolio Documents Stat Tiles

| Tile                  | Definition                                                           |
| --------------------- | -------------------------------------------------------------------- |
| **Out for signature** | Count of documents in "Out for signature" status across all projects |
| **Drafts**            | Count of documents in Draft status                                   |
| **Executed**          | Count of executed certificates                                       |
| **Awaiting you**      | Count of documents pending the contractor's own signature            |

---

## 21. People & Roles Management

- Lists all workspace members.
- Assign **roles** to members.
- **Role builder:** compose custom roles from the platform's permission catalog (not free-form text).
- `RoleAssignment` records link users to roles.
- **Invariant:** at least one member must always hold the `manage_roles` permission — cannot remove the last `manage_roles` holder.

### Permission Catalog

| Permission key          | What it grants                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| `manage_roles`          | Create, edit, and delete roles; assign roles to members                |
| `manage_members`        | Invite and remove workspace members                                    |
| `manage_projects`       | Create and archive projects; edit project basics                       |
| `manage_terms`          | Edit `AgreementTerms` while they are unlocked                          |
| `manage_branding`       | Edit brand settings (colour, logo, domain)                             |
| `manage_settings`       | Edit workspace-level settings (grace window, retention default, etc.)  |
| `submit_draw`           | Submit a draw request on behalf of the contractor                      |
| `release_draw`          | Mark a draw as released after receiving payment                        |
| `manage_payables`       | Create payables; mark payables as paid                                 |
| `manage_budget`         | Create and edit budget lines                                           |
| `manage_materials`      | Create materials; record deliveries and usage                          |
| `manage_subcontractors` | Invite subcontractor orgs; manage sub compliance                       |
| `manage_snags`          | Assign snags; invoke admin-override closure                            |
| `manage_documents`      | Create, issue, and void project documents and certificates             |
| `manage_variations`     | Submit and approve/reject variations                                   |
| `manage_schedule`       | Create and update phases, milestones, and delivery dates               |
| `view_payables`         | View money-out (payables) — org-only; not grantable to client sessions |
| `view_budget`           | View budget lines at org disclosure depth                              |

- Every permission is toggled independently when building a custom role.
- Each role record has a `name` (EN) and `name_ar` (AR) field — both are required when creating or cloning a role. The role builder UI renders the name in the active locale.
- System-generated roles (e.g., "Owner", "PM") are read-only but can be cloned as starting points.

---

## 22. Branding & White-Label Settings

### Brand Entity Model

A `Brand` is a named configuration record owned by the workspace.

- A workspace can have **multiple Brands** (e.g., one per product line or sub-brand).
- **Default Brand** is created automatically at workspace signup with the accent colour chosen in the signup Step 2 picker.
- **Projects reference a Brand** via `brandId` — set in the project creation wizard (Step 1) and editable in Setup Tab while no client has accessed the portal. **"Accessed"** means the client has opened the branded project portal URL in an authenticated session — tracked via a `first_client_access_at` timestamp on the project record. Once set, `brandId` changes are blocked at the API layer on `PATCH /projects/:id`. This rule is enforced server-side regardless of the UI path.
  - **Edge case:** `first_client_access_at` is only set when the client opens the portal URL in an authenticated Inframodern session (i.e. after accepting their invite and completing OTP). An unauthenticated URL visit (e.g. a preview link before invite acceptance) does not set this timestamp and does not lock `brandId`.
- Brand fields:
  - `name` — display label for the brand (e.g., "Main", "Residential", "Commercial")
  - `accentColour` — hex value
  - `logoAssetId` — reference to the uploaded logo asset
  - `customDomain` — nullable; CNAME-verified custom domain for this brand's client portal
  - `removeMaterialFooter` — boolean; Growth plan only

### Settings

- Set **accent colour** per brand.
- Upload **logo** per brand.
- Configure a **custom domain** per brand (CNAME + SSL provisioning).
- **Live preview** of the client portal with the brand applied — updates in real time as settings change.
- Branding is applied at the **project level** via the project's `brandId` — not globally at the app level.
- The client's cross-contractor home remains brand-neutral; only per-project portal views are branded.
- **"Secured by Materiabill" footer:** Contractors on the **Growth plan** can toggle this footer off per brand (`removeMaterialFooter = true`). Contractors on the **Starter plan** cannot remove it — it is mandatory.
- **Public share links toggle:** Enable or disable public share links for project documents.
- **Plan tiers (Starter / Growth):** govern access to branding features including footer removal and future white-label options.

---

## 23. Workspace Settings

- **Grace window duration** (org default: 10 minutes; overridable per project).
- **Default retention percentage (default: 5%)** (applied to new projects unless overridden in project terms).
- **Default disclosure depth** (category rollup vs line-level; overridable per project).
- **Notification preferences** — channel toggles per event type: email and in-app available at launch. **WhatsApp** notifications are planned for **v1.5** — toggle is shown but disabled at launch.
- **Suggestion throttle** — maximum number of open client suggestions per material item.
- **Contractor invite auto-nudge window** — applies to **Invite Variant B only** (client creates a stub and invites a contractor by firm name or email). Period after which the invited contractor has not claimed the stub triggers an automatic reminder to **the contractor** (default: 48 hours; configurable). Has no effect on standard contractor-initiated client invites.

---

## 24. Subcontractor Workspace View (Workspace Switch)

- When a project has a subcontractor on-platform, the contractor can **switch to the sub's workspace view** to see the project from the sub's perspective.
- This demonstrates the `PaymentEdge` and the recursive model in action.
- The contractor's payable to the sub is the sub's incoming `DrawItem` — one shared financial edge.
- Pay-when-paid and goodwill propagate along this edge.

### Access Model (D2)

- **Authorization:** no explicit grant required from the subcontractor. Access is implicitly authorised by the existence of a `PaymentEdge` joining the two workspaces for this project. If the `PaymentEdge` is revoked or the sub is removed, access is immediately lost.
- **Scope:** access is read-only and strictly scoped to the shared project boundary defined by the `PaymentEdge`. The contractor cannot see any data in the sub's workspace outside of that project.
- **Session:** the contractor's session identity does not change — they remain authenticated as themselves. The view is rendered as a read-only projection of the sub's project data, not a true session switch.
- **Audit trail:** every access event is recorded as an audit entry in the sub's workspace labeled "internal" with the accessing contractor's workspace identity and timestamp.
- **Subcontractor visibility:** the subcontractor can see in their own audit trail that the contractor has viewed their data and when.

---

**Client portal:** client-facing screens, navigation flows, and the branded per-project portal are specified in `Mobile/mobile-business-requirements.md`. The following endpoints and behaviors in this web spec have direct client-facing counterparts: §7 draw approval → client approval action; §9 continuity → client continuity view; §14 snag close → client closes; §15 document signing → client signs; §16 invite → client onboarding.

---

## Status Value Enumerations

| Entity                     | Status progression                              |
| -------------------------- | ----------------------------------------------- |
| **Project**                | On plan · Behind · Stale                        |
| **Draw**                   | Pending → Approved → Released                   |
| **Payable**                | Pending → Paid                                  |
| **Material**               | Ordered → In transit → Delivered → Installed    |
| **Submittal**              | Pending → Under review → Approved (or Rejected) |
| **Design package**         | Draft → Issued → Approved                       |
| **Variation**              | Pending → Approved (or Rejected)                |
| **Snag**                   | Open → In progress → Fixed → Closed             |
| **Document / Certificate** | Draft → Out for signature → Executed            |
| **Milestone**              | Not started → In progress → Complete            |
| **Sub compliance badge**   | Valid · Expired · Missing                       |
| **ContinuityRecord**       | on_track · carrying · paused                    |

---

## Open Decisions

The following 5 decisions are **unresolved** as of the engineering handoff and must be resolved before the corresponding build phases start:

| #   | Decision                       | Options / Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Client identity source**     | **Materiabill-native `ClientIdentity`** (verified email/phone) vs **Inframodern customer projection** (reuse the Inframodern customer record). **This document is written assuming Materiabill-native**, which all business docs recommend for v1. Blast radius of switching to the projection: §4 (AgreementTerms client reference), §5 (settlement bar client identity), §16 (invite flow), §22 (branded portal domain scoping), and the auth boundary for client-facing endpoints. Resolve before building the invite flow. _(The BRD's older "Option A/B" letters were swapped relative to this doc — options are named, not lettered, to avoid the collision.)_ |
| 2   | **Participant ↔ org boundary** | Whether project participants are org members only or can include external contacts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | **Stub ownership**             | Who owns a client-created stub before a contractor claims it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | **Billing model**              | Per-seat, per-project, or usage-based; which plan gates which features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | **Disclosure computation**     | Server-computes filtered BOM on the fly vs materialises a client-facing snapshot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Cross-Cutting Rules (Web)

| Rule                        | Detail                                                                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commercial model lock**   | Terms lock when the first `DrawItem` transitions from Pending to Approved — the client's first draw approval is the definitive "first client-visible financial record" trigger. At v1, variation approval and other financial records do not trigger this lock — only DrawItem Pending → Approved. |
| **Immutability**            | Approved variations, executed certificates, resolved sign-offs, released payments, agreed baselines — all append-only                                                                                                                                                                              |
| **Grace window**            | All decisions have a 10-min undo window before committing and notifications fan out. Two undo surfaces: (1) the undoable toast (5.2 s); (2) the Pending Decisions Panel (accessible for the full grace-window duration via the clock icon in the nav bar)                                          |
| **Audience enforcement**    | Visibility (org \| participants \| client) enforced server-side on all reads/writes                                                                                                                                                                                                                |
| **Money-out always hidden** | Payables are never client-visible, regardless of audience setting                                                                                                                                                                                                                                  |
| **Multi-currency**          | Every amount must carry a currency; portfolio rollups use synced exchange rates                                                                                                                                                                                                                    |
| **Immutable IDs**           | Materiabill never generates local IDs for Inframodern-synced rows — Inframodern ID is the key                                                                                                                                                                                                      |
| **Bilingual**               | EN/AR support with RTL layout for Arabic                                                                                                                                                                                                                                                           |
