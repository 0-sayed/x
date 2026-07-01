CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key"),
	CONSTRAINT "role_permissions_permission_key_catalog_check" CHECK("permission_key" IN ('workspace.view', 'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'agreement_terms.view', 'agreement_terms.configure', 'schedule.view', 'schedule.manage', 'schedule.propose_baseline', 'milestones.complete', 'draws.view', 'draws.create', 'draws.submit', 'draws.release', 'draws.release_retention', 'payables.view', 'payables.create', 'payables.pay', 'continuity.view', 'continuity.pause', 'budget.view', 'budget.manage', 'budget.set_audience', 'materials.view', 'materials.create', 'materials.edit', 'materials.receive', 'materials.use', 'materials.manage_po', 'suggestions.view', 'suggestions.resolve', 'subcontractors.view', 'subcontractors.create', 'subcontractors.edit', 'subcontractors.manage_compliance', 'submittals.view', 'submittals.create', 'submittals.review', 'submittals.approve', 'variations.view', 'variations.create', 'variations.approve', 'documents.view', 'documents.create', 'documents.send_for_signature', 'documents.void', 'manage_documents', 'certificates.view', 'certificates.generate', 'signoffs.view', 'snags.view', 'snags.create', 'snags.assign', 'snags.fix', 'manage_snags', 'people.view', 'roles.view', 'roles.create', 'roles.edit', 'manage_roles', 'user_role_assignments.manage', 'branding.view', 'branding.manage', 'settings.view', 'settings.manage_defaults', 'audit.view', 'search.use'))
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_assignments_workspace_id_user_id_role_id_pk" PRIMARY KEY("workspace_id","user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"system_key" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"cloned_from_role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_workspace_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspace_id_id_unique" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_workspace_id_role_id_workspace_roles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "public"."workspace_roles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_workspace_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_workspace_id_role_id_workspace_roles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "public"."workspace_roles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_permissions_workspace_id_idx" ON "role_permissions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_key_idx" ON "role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE INDEX "user_role_assignments_workspace_id_idx" ON "user_role_assignments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_role_id_idx" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workspace_roles_workspace_id_idx" ON "workspace_roles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_roles_system_key_idx" ON "workspace_roles" USING btree ("workspace_id","system_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_roles_workspace_system_key_unique_idx" ON "workspace_roles" USING btree ("workspace_id","system_key") WHERE system_key IS NOT NULL AND is_system = true AND deleted_at IS NULL;
