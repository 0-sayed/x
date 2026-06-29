# Materiabill Seed Data (Web Phase)

Backend-owned seed data: the contractor-admin permission catalog, default role
templates, and workspace configuration defaults seeded when a workspace is
projected from Inframodern.

## Permission Catalog (Contractor Admin)

| Area                     | Permission keys                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                | `workspace.view`                                                                                                                                         |
| Projects                 | `projects.view`, `projects.create`, `projects.edit`, `projects.archive`                                                                                  |
| Agreement terms          | `agreement_terms.view`, `agreement_terms.configure`                                                                                                      |
| Schedule                 | `schedule.view`, `schedule.manage`, `schedule.propose_baseline`, `milestones.complete`                                                                   |
| Draws (money-in)         | `draws.view`, `draws.create`, `draws.submit`, `draws.release`, `draws.release_retention`                                                                 |
| Payables (money-out)     | `payables.view`, `payables.create`, `payables.pay`                                                                                                       |
| Continuity               | `continuity.view`, `continuity.pause`                                                                                                                    |
| Budget                   | `budget.view`, `budget.manage`, `budget.set_audience`                                                                                                    |
| Materials / BOM          | `materials.view`, `materials.create`, `materials.edit`, `materials.receive`, `materials.use`, `materials.manage_po`                                      |
| Suggestions              | `suggestions.view`, `suggestions.resolve`                                                                                                                |
| Subcontractors           | `subcontractors.view`, `subcontractors.create`, `subcontractors.edit`, `subcontractors.manage_compliance`                                                |
| Submittals / variations  | `submittals.view`, `submittals.create`, `submittals.review`, `submittals.approve`, `variations.view`, `variations.create`, `variations.approve`          |
| Documents / certificates | `documents.view`, `documents.create`, `documents.send_for_signature`, `documents.void`, `manage_documents`, `certificates.view`, `certificates.generate` |
| Sign-offs                | `signoffs.view`                                                                                                                                          |
| Snags                    | `snags.view`, `snags.create`, `snags.assign`, `snags.fix`, `manage_snags`                                                                                |
| People & roles           | `people.view`, `roles.view`, `roles.create`, `roles.edit`, `manage_roles`, `user_role_assignments.manage`                                                |
| Branding                 | `branding.view`, `branding.manage`                                                                                                                       |
| Settings                 | `settings.view`, `settings.manage_defaults`                                                                                                              |
| Audit                    | `audit.view`                                                                                                                                             |
| Search                   | `search.use`                                                                                                                                             |

Notes:

- `payables.*` are org-only; they never grant any client-audience visibility.
- `draws.approve` is a **client-only** capability and is intentionally **not**
  in the contractor catalog — contractor sessions must not be authorized for it.
- `manage_snags` grants the abandoned-snag override (close when client deleted
  or snag Fixed ≥ 30 days); ordinary closure remains client-only.
- At least one member of every workspace must always hold `manage_roles`.

## Default Role Templates

Editable starter templates (not hard-coded product roles); each is a custom set
of permission keys.

1. **Workspace Admin** — all active permissions.
2. **Project Manager** — projects, schedule, materials, submittals/variations,
   documents/certificates, snags, subcontractors, draw submit; excludes role
   management, payables payment, and settings defaults.
3. **Finance** — draws (incl. release & retention), payables, budget,
   continuity, audit view; excludes project/schedule editing and role mgmt.
4. **Viewer** — `*.view` permissions across areas; no mutations.

Rules:

- Roles are custom permission sets per workspace; backend authorizes on
  `role_permissions`, not role titles.
- Each role carries bilingual labels (`name_en`, `name_ar`).

## Workspace Defaults

Seeded when a workspace projection is enabled.

| Setting                            | Seed value                                  |
| ---------------------------------- | ------------------------------------------- |
| `currency`                         | `SAR` (primary; `EGP` supported)            |
| `timezone`                         | `Asia/Riyadh`                               |
| `default_language`                 | `en` (`ar` supported, RTL)                  |
| `default_retention_percentage`     | `5`                                         |
| `grace_window_minutes`             | `10`                                        |
| `default_disclosure_depth`         | `none` (`none                               | category | line`) |
| `invite_auto_nudge_hours`          | `48` (Invite Variant B only)                |
| `suggestion_throttle_per_material` | cap on open client suggestions per material |
| `notification_channels`            | in-app + email on; WhatsApp deferred (v1.5) |

Rules:

- These are Materiabill operational defaults, not Inframodern workspace identity.
- Workspace name, lifecycle, members, customers, taxes, and exchange rates stay
  synced read-only from Inframodern.
- Currency is stored as an ISO code alongside every money record; minor units in
  the database, decimal.js for math.
- `grace_window_minutes` and `default_retention_percentage` are org-level
  defaults, each overridable per project.
