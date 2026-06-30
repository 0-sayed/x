CREATE TABLE "sync_checkpoints" (
	"resource" text PRIMARY KEY NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event_id" text,
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"resource" text NOT NULL,
	"correlation_id" text NOT NULL,
	"operation_id" text,
	"job_id" text,
	"payload" jsonb NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_inbox" (
	"event_id" text PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"correlation_id" text NOT NULL,
	"operation_id" text,
	"job_id" text,
	"target_app" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_event_id_sync_inbox_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sync_inbox"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_failures_event_id_idx" ON "sync_failures" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sync_failures_resource_failed_at_idx" ON "sync_failures" USING btree ("resource","failed_at");--> statement-breakpoint
CREATE INDEX "sync_failures_resolved_at_idx" ON "sync_failures" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "sync_inbox_resource_received_at_idx" ON "sync_inbox" USING btree ("resource","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_inbox_operation_id_idx" ON "sync_inbox" USING btree ("operation_id");