CREATE TABLE "pending_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"requested_by_user_id" uuid,
	"status" varchar(16) NOT NULL,
	"audience" varchar(16) NOT NULL,
	"decision_type" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text,
	"summary_label" text NOT NULL,
	"commit_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"undo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"undone_at" timestamp with time zone,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_decisions_status_check" CHECK ("pending_decisions"."status" in ('pending', 'undone', 'committed')),
	CONSTRAINT "pending_decisions_audience_check" CHECK ("pending_decisions"."audience" in ('org', 'participants', 'client'))
);
--> statement-breakpoint
ALTER TABLE "pending_decisions" ADD CONSTRAINT "pending_decisions_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_decisions" ADD CONSTRAINT "pending_decisions_requested_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_decisions_workspace_status_expires_at_idx" ON "pending_decisions" USING btree ("workspace_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "pending_decisions_workspace_project_status_expires_at_idx" ON "pending_decisions" USING btree ("workspace_id","project_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "pending_decisions_requested_by_user_id_idx" ON "pending_decisions" USING btree ("requested_by_user_id");