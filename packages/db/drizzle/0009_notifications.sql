CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"notification_id" uuid,
	"recipient_user_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"channel" varchar(24) NOT NULL,
	"status" varchar(24) NOT NULL,
	"recipient_address" text,
	"provider_message_id" text,
	"skipped_reason" text,
	"error_message" text,
	"attempted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_event_type_check" CHECK ("notification_deliveries"."event_type" in ('draw.approved', 'draw.released', 'snag.opened', 'snag.fixed', 'snag.closed', 'variation.submitted', 'variation.approved', 'document.signed', 'invite.accepted', 'invite.declined', 'invite.contractor_nudge')),
	CONSTRAINT "notification_deliveries_channel_check" CHECK ("notification_deliveries"."channel" in ('in_app', 'email', 'whatsapp')),
	CONSTRAINT "notification_deliveries_status_check" CHECK ("notification_deliveries"."status" in ('sent', 'skipped', 'failed', 'placeholder'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"channel" varchar(24) NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_event_type_check" CHECK ("notification_preferences"."event_type" in ('draw.approved', 'draw.released', 'snag.opened', 'snag.fixed', 'snag.closed', 'variation.submitted', 'variation.approved', 'document.signed', 'invite.accepted', 'invite.declined', 'invite.contractor_nudge')),
	CONSTRAINT "notification_preferences_channel_check" CHECK ("notification_preferences"."channel" in ('in_app', 'email', 'whatsapp')),
	CONSTRAINT "notification_preferences_whatsapp_enabled_check" CHECK (not ("notification_preferences"."channel" = 'whatsapp' and "notification_preferences"."enabled"))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_event_type_check" CHECK ("notifications"."event_type" in ('draw.approved', 'draw.released', 'snag.opened', 'snag.fixed', 'snag.closed', 'variation.submitted', 'variation.approved', 'document.signed', 'invite.accepted', 'invite.declined', 'invite.contractor_nudge'))
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_workspace_attempted_at_idx" ON "notification_deliveries" USING btree ("workspace_id","attempted_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_workspace_notification_attempted_at_idx" ON "notification_deliveries" USING btree ("workspace_id","notification_id","attempted_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_workspace_recipient_attempted_at_idx" ON "notification_deliveries" USING btree ("workspace_id","recipient_user_id","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_workspace_event_channel_uidx" ON "notification_preferences" USING btree ("workspace_id","event_type","channel");--> statement-breakpoint
CREATE INDEX "notifications_workspace_recipient_created_at_idx" ON "notifications" USING btree ("workspace_id","recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_workspace_recipient_read_at_created_at_idx" ON "notifications" USING btree ("workspace_id","recipient_user_id","read_at","created_at");