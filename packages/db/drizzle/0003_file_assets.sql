CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"storage_provider" varchar(16) NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "file_assets_storage_key_uidx" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_assets_workspace_id_idx" ON "file_assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "file_assets_uploaded_by_user_id_idx" ON "file_assets" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "file_assets_workspace_purpose_created_at_idx" ON "file_assets" USING btree ("workspace_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "file_assets_checksum_sha256_idx" ON "file_assets" USING btree ("checksum_sha256");
