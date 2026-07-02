CREATE TABLE "milestone_draw_links" (
	"milestone_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"draw_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_draw_links_milestone_id_draw_item_id_pk" PRIMARY KEY("milestone_id","draw_item_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_baseline_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baseline_id" uuid NOT NULL,
	"source_milestone_id" uuid,
	"phase_name" text NOT NULL,
	"milestone_name" text NOT NULL,
	"baseline_date" date NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "schedule_baseline_milestones_display_order_check" CHECK ("schedule_baseline_milestones"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(24) NOT NULL,
	"proposed_by_user_id" uuid,
	"sign_off_id" uuid,
	"self_certified_by_user_id" uuid,
	"self_certified_reason" text,
	"agreed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_baselines_status_check" CHECK ("schedule_baselines"."status" in ('draft', 'proposed', 'agreed', 'self_certified')),
	CONSTRAINT "schedule_baselines_self_certified_reason_check" CHECK ("schedule_baselines"."status" != 'self_certified' OR nullif(trim("schedule_baselines"."self_certified_reason"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "schedule_forecast_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"old_forecast_date" date NOT NULL,
	"new_forecast_date" date NOT NULL,
	"reason" text NOT NULL,
	"moved_by_user_id" uuid NOT NULL,
	"moved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_forecast_moves_reason_check" CHECK (nullif(trim("schedule_forecast_moves"."reason"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "schedule_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"forecast_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_milestones_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "schedule_milestones_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id"),
	CONSTRAINT "schedule_milestones_display_order_check" CHECK ("schedule_milestones"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_phases_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "schedule_phases_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id"),
	CONSTRAINT "schedule_phases_display_order_check" CHECK ("schedule_phases"."display_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "milestone_draw_links" ADD CONSTRAINT "milestone_draw_links_workspace_id_milestone_id_milestones_fk" FOREIGN KEY ("workspace_id","milestone_id") REFERENCES "public"."schedule_milestones"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baseline_milestones" ADD CONSTRAINT "schedule_baseline_milestones_baseline_id_schedule_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."schedule_baselines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_workspace_id_project_id_projects_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_workspace_id_proposed_by_user_id_membership_fk" FOREIGN KEY ("workspace_id","proposed_by_user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_workspace_id_project_id_sign_off_id_sign_offs_workspace_id_project_id_id_fk" FOREIGN KEY ("workspace_id","project_id","sign_off_id") REFERENCES "public"."sign_offs"("workspace_id","project_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_workspace_id_self_certified_by_user_id_membership_fk" FOREIGN KEY ("workspace_id","self_certified_by_user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_forecast_moves" ADD CONSTRAINT "schedule_forecast_moves_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_forecast_moves" ADD CONSTRAINT "schedule_forecast_moves_workspace_id_project_id_milestone_id_milestones_fk" FOREIGN KEY ("workspace_id","project_id","milestone_id") REFERENCES "public"."schedule_milestones"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_forecast_moves" ADD CONSTRAINT "schedule_forecast_moves_workspace_id_moved_by_user_id_membership_fk" FOREIGN KEY ("workspace_id","moved_by_user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_milestones" ADD CONSTRAINT "schedule_milestones_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_milestones" ADD CONSTRAINT "schedule_milestones_workspace_id_project_id_projects_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_milestones" ADD CONSTRAINT "schedule_milestones_workspace_id_project_id_phase_id_schedule_phases_workspace_id_project_id_id_fk" FOREIGN KEY ("workspace_id","project_id","phase_id") REFERENCES "public"."schedule_phases"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_milestones" ADD CONSTRAINT "schedule_milestones_workspace_id_completed_by_user_id_membership_fk" FOREIGN KEY ("workspace_id","completed_by_user_id") REFERENCES "public"."workspace_membership_refs"("workspace_id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_phases" ADD CONSTRAINT "schedule_phases_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_phases" ADD CONSTRAINT "schedule_phases_workspace_id_project_id_projects_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestone_draw_links_workspace_draw_item_idx" ON "milestone_draw_links" USING btree ("workspace_id","draw_item_id");--> statement-breakpoint
CREATE INDEX "schedule_baseline_milestones_baseline_order_idx" ON "schedule_baseline_milestones" USING btree ("baseline_id","display_order");--> statement-breakpoint
CREATE INDEX "schedule_baselines_workspace_project_status_idx" ON "schedule_baselines" USING btree ("workspace_id","project_id","status");--> statement-breakpoint
CREATE INDEX "schedule_baselines_sign_off_id_idx" ON "schedule_baselines" USING btree ("sign_off_id");--> statement-breakpoint
CREATE INDEX "schedule_forecast_moves_workspace_project_moved_at_idx" ON "schedule_forecast_moves" USING btree ("workspace_id","project_id","moved_at");--> statement-breakpoint
CREATE INDEX "schedule_milestones_workspace_project_order_idx" ON "schedule_milestones" USING btree ("workspace_id","project_id","display_order");--> statement-breakpoint
CREATE INDEX "schedule_milestones_workspace_phase_idx" ON "schedule_milestones" USING btree ("workspace_id","phase_id");--> statement-breakpoint
CREATE INDEX "schedule_phases_workspace_project_order_idx" ON "schedule_phases" USING btree ("workspace_id","project_id","display_order");--> statement-breakpoint
ALTER TABLE "sign_offs" ADD CONSTRAINT "sign_offs_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id");