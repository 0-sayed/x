CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"default_language" varchar(8) DEFAULT 'en' NOT NULL,
	"default_retention_percentage" integer DEFAULT 5 NOT NULL,
	"grace_window_minutes" integer DEFAULT 10 NOT NULL,
	"default_disclosure_depth" varchar(16) DEFAULT 'none' NOT NULL,
	"suggestion_throttle_per_material" integer DEFAULT 5 NOT NULL,
	"invite_auto_nudge_hours" integer DEFAULT 48 NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"default":{"inApp":true,"email":true,"whatsapp":false},"contractorInviteAutoNudge":{"inApp":true,"email":true,"whatsapp":false}}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_currency_check" CHECK ("workspace_settings"."currency" IN ('SAR', 'EGP')),
	CONSTRAINT "workspace_settings_default_language_check" CHECK ("workspace_settings"."default_language" IN ('en', 'ar')),
	CONSTRAINT "workspace_settings_default_retention_percentage_check" CHECK ("workspace_settings"."default_retention_percentage" >= 0 AND "workspace_settings"."default_retention_percentage" <= 100),
	CONSTRAINT "workspace_settings_grace_window_minutes_check" CHECK ("workspace_settings"."grace_window_minutes" >= 1 AND "workspace_settings"."grace_window_minutes" <= 1440),
	CONSTRAINT "workspace_settings_default_disclosure_depth_check" CHECK ("workspace_settings"."default_disclosure_depth" IN ('none', 'category', 'line')),
	CONSTRAINT "workspace_settings_suggestion_throttle_per_material_check" CHECK ("workspace_settings"."suggestion_throttle_per_material" >= 0 AND "workspace_settings"."suggestion_throttle_per_material" <= 100),
	CONSTRAINT "workspace_settings_invite_auto_nudge_hours_check" CHECK ("workspace_settings"."invite_auto_nudge_hours" >= 1 AND "workspace_settings"."invite_auto_nudge_hours" <= 720)
);
--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_key_catalog_check";--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_catalog_check" CHECK ("role_permissions"."permission_key" IN ('workspace.view', 'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'agreement_terms.view', 'agreement_terms.configure', 'schedule.view', 'schedule.manage', 'schedule.propose_baseline', 'milestones.complete', 'draws.view', 'draws.create', 'draws.submit', 'draws.release', 'draws.release_retention', 'payables.view', 'payables.create', 'payables.pay', 'continuity.view', 'continuity.pause', 'budget.view', 'budget.manage', 'budget.set_audience', 'materials.view', 'materials.create', 'materials.edit', 'materials.receive', 'materials.use', 'materials.manage_po', 'suggestions.view', 'suggestions.resolve', 'subcontractors.view', 'subcontractors.create', 'subcontractors.edit', 'subcontractors.manage_compliance', 'submittals.view', 'submittals.create', 'submittals.review', 'submittals.approve', 'variations.view', 'variations.create', 'variations.approve', 'documents.view', 'documents.create', 'documents.send_for_signature', 'documents.void', 'manage_documents', 'certificates.view', 'certificates.generate', 'signoffs.view', 'snags.view', 'snags.create', 'snags.assign', 'snags.fix', 'manage_snags', 'people.view', 'roles.view', 'roles.create', 'roles.edit', 'manage_roles', 'user_role_assignments.manage', 'branding.view', 'branding.manage', 'settings.view', 'settings.manage_defaults', 'audit.view', 'search.use'));