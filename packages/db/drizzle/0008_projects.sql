CREATE TABLE "project_participants" (
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_participants_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(16) DEFAULT 'on_plan' NOT NULL,
	"now" text,
	"bottleneck" text,
	"baseline_delivery_date" date NOT NULL,
	"pm_user_id" uuid,
	"location_id" uuid,
	"client_org_id" uuid,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" in ('on_plan', 'behind', 'stale'))
);
--> statement-breakpoint
ALTER TABLE "location_refs" ADD CONSTRAINT "location_refs_workspace_id_id_unique" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_workspace_id_project_id_projects_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_pm_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("pm_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_location_id_location_refs_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_pm_user_id_workspace_membership_refs_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","pm_user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_location_id_location_refs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","location_id") REFERENCES "public"."location_refs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_org_id_workspace_refs_id_fk" FOREIGN KEY ("client_org_id") REFERENCES "public"."workspace_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_participants_workspace_user_idx" ON "project_participants" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_archived_status_city_idx" ON "projects" USING btree ("workspace_id","archived_at","status","city");--> statement-breakpoint
CREATE INDEX "projects_workspace_pm_user_idx" ON "projects" USING btree ("workspace_id","pm_user_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_location_idx" ON "projects" USING btree ("workspace_id","location_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_client_org_idx" ON "projects" USING btree ("workspace_id","client_org_id");
