ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_key_catalog_check";--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_catalog_check" CHECK("permission_key" IN ('workspace.view', 'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'agreement_terms.view', 'agreement_terms.configure', 'schedule.view', 'schedule.manage', 'schedule.propose_baseline', 'milestones.complete', 'draws.view', 'draws.create', 'draws.submit', 'draws.release', 'draws.release_retention', 'payables.view', 'payables.create', 'payables.pay', 'continuity.view', 'continuity.pause', 'budget.view', 'budget.manage', 'budget.set_audience', 'materials.view', 'materials.create', 'materials.edit', 'materials.receive', 'materials.use', 'materials.manage_po', 'suggestions.view', 'suggestions.resolve', 'subcontractors.view', 'subcontractors.create', 'subcontractors.edit', 'subcontractors.manage_compliance', 'submittals.view', 'submittals.create', 'submittals.review', 'submittals.approve', 'variations.view', 'variations.create', 'variations.approve', 'documents.view', 'documents.create', 'documents.send_for_signature', 'documents.void', 'manage_documents', 'certificates.view', 'certificates.generate', 'signoffs.view', 'signoffs.respond', 'signoffs.remind', 'snags.view', 'snags.create', 'snags.assign', 'snags.fix', 'manage_snags', 'people.view', 'roles.view', 'roles.create', 'roles.edit', 'manage_roles', 'user_role_assignments.manage', 'branding.view', 'branding.manage', 'settings.view', 'settings.manage_defaults', 'audit.view', 'search.use'));--> statement-breakpoint
CREATE UNIQUE INDEX "pending_decisions_pending_record_unique_idx" ON "pending_decisions" USING btree ("workspace_id","decision_type","record_type","record_id") WHERE status = 'pending' AND record_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE "sign_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"assigned_audience" varchar(16) NOT NULL,
	"required_action" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"requested_by_user_id" uuid,
	"resolved_by_user_id" uuid,
	"resolution_reason" text,
	"resolution_decision_id" uuid,
	"last_reminder_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "sign_offs_assigned_audience_check" CHECK ("assigned_audience" in ('org', 'participants', 'client')),
	CONSTRAINT "sign_offs_required_action_check" CHECK ("required_action" in ('approve', 'sign')),
	CONSTRAINT "sign_offs_status_check" CHECK ("status" in ('pending', 'approved', 'rejected', 'signed')),
	CONSTRAINT "sign_offs_reject_reason_check" CHECK ("status" != 'rejected' OR nullif(trim("resolution_reason"), '') IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "sign_offs" ADD CONSTRAINT "sign_offs_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_offs" ADD CONSTRAINT "sign_offs_requested_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_offs" ADD CONSTRAINT "sign_offs_resolved_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_offs" ADD CONSTRAINT "sign_offs_resolution_decision_id_pending_decisions_id_fk" FOREIGN KEY ("resolution_decision_id") REFERENCES "public"."pending_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sign_offs_workspace_status_created_at_idx" ON "sign_offs" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sign_offs_workspace_project_status_created_at_idx" ON "sign_offs" USING btree ("workspace_id","project_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sign_offs_workspace_assigned_status_idx" ON "sign_offs" USING btree ("workspace_id","assigned_audience","status");--> statement-breakpoint
CREATE INDEX "sign_offs_workspace_subject_idx" ON "sign_offs" USING btree ("workspace_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "sign_offs_requested_by_user_id_idx" ON "sign_offs" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "sign_offs_resolved_by_user_id_idx" ON "sign_offs" USING btree ("resolved_by_user_id");--> statement-breakpoint
CREATE INDEX "sign_offs_resolution_decision_id_idx" ON "sign_offs" USING btree ("resolution_decision_id");