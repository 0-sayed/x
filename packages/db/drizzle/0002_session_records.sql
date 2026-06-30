CREATE TABLE "session_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"active_workspace_id" uuid,
	"encrypted_tokens" text NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "session_records" ADD CONSTRAINT "session_records_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_records" ADD CONSTRAINT "session_records_active_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("active_workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_records_user_id_idx" ON "session_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_records_expires_at_idx" ON "session_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_records_revoked_at_idx" ON "session_records" USING btree ("revoked_at");