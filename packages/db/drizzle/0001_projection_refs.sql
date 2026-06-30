CREATE TABLE "brand_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"name" text NOT NULL,
	"accent_color" varchar(32),
	"logo_url" text,
	"custom_domain" text,
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"quote_currency" varchar(3) NOT NULL,
	"rate" numeric(24, 12) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"source" text,
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inframodern_user_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"phone" text,
	"avatar_url" text,
	"locale" varchar(16),
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "location_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"name" text NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"region" text,
	"country_code" varchar(2),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "measurement_unit_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"category" text,
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tax_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(8, 5) NOT NULL,
	"country_code" varchar(2),
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_membership_refs" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_key" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspace_membership_refs_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_refs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"payment_currency" varchar(3),
	"is_installed" boolean DEFAULT false NOT NULL,
	"subscription_active" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brand_refs" ADD CONSTRAINT "brand_refs_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_refs" ADD CONSTRAINT "location_refs_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership_refs" ADD CONSTRAINT "workspace_membership_refs_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership_refs" ADD CONSTRAINT "workspace_membership_refs_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_refs_workspace_id_idx" ON "brand_refs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "exchange_rate_refs_base_quote_effective_at_idx" ON "exchange_rate_refs" USING btree ("base_currency","quote_currency","effective_at");--> statement-breakpoint
CREATE INDEX "inframodern_user_refs_email_idx" ON "inframodern_user_refs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "location_refs_workspace_id_idx" ON "location_refs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "measurement_unit_refs_code_idx" ON "measurement_unit_refs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_refs_code_idx" ON "tax_refs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "workspace_membership_refs_workspace_id_idx" ON "workspace_membership_refs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_refs_user_id_idx" ON "workspace_membership_refs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_refs_slug_idx" ON "workspace_refs" USING btree ("slug");