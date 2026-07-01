CREATE TABLE "client_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" varchar(320),
	"phone_e164" varchar(32),
	"verified_email_at" timestamp with time zone,
	"verified_phone_at" timestamp with time zone,
	"inframodern_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_identities_contact_check" CHECK ("client_identities"."email" is not null or "client_identities"."phone_e164" is not null),
	CONSTRAINT "client_identities_email_verified_check" CHECK ("client_identities"."email" is null or "client_identities"."verified_email_at" is not null),
	CONSTRAINT "client_identities_phone_verified_check" CHECK ("client_identities"."phone_e164" is null or "client_identities"."verified_phone_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "end_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "client_identities" ADD CONSTRAINT "client_identities_inframodern_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("inframodern_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_identities_email_unique" ON "client_identities" USING btree (lower("email")) WHERE "client_identities"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "client_identities_phone_e164_unique" ON "client_identities" USING btree ("phone_e164") WHERE "client_identities"."phone_e164" is not null;--> statement-breakpoint
CREATE INDEX "client_identities_inframodern_user_idx" ON "client_identities" USING btree ("inframodern_user_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_end_customer_id_client_identities_id_fk" FOREIGN KEY ("end_customer_id") REFERENCES "public"."client_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_workspace_end_customer_idx" ON "projects" USING btree ("workspace_id","end_customer_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_exactly_one_client_check" CHECK (num_nonnulls("projects"."end_customer_id", "projects"."client_org_id") = 1);