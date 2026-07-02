CREATE FUNCTION "agreement_terms_reimbursable_categories_valid"("categories" jsonb) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT CASE
		WHEN jsonb_typeof("categories") <> 'array' THEN false
		ELSE jsonb_array_length("categories") >= 1
			AND NOT EXISTS (
				SELECT 1
				FROM jsonb_array_elements("categories") AS "category"("value")
				WHERE jsonb_typeof("category"."value") <> 'string'
					OR "category"."value" #>> '{}' <> btrim("category"."value" #>> '{}')
					OR length("category"."value" #>> '{}') < 1
					OR length("category"."value" #>> '{}') > 80
			)
			AND jsonb_array_length("categories") = (
				SELECT count(DISTINCT btrim("category"."value" #>> '{}'))
				FROM jsonb_array_elements("categories") AS "category"("value")
			)
	END
$$;
--> statement-breakpoint
CREATE TABLE "agreement_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"commercial_model" varchar(16) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"disclosure_depth" varchar(16) NOT NULL,
	"retention_percentage" integer NOT NULL,
	"billing_cycle" varchar(16) NOT NULL,
	"contract_value_minor" bigint,
	"fee_basis" varchar(16),
	"fee_percentage_bps" integer,
	"fee_amount_minor" bigint,
	"target_cost_minor" bigint,
	"gmp_ceiling_minor" bigint,
	"savings_split_contractor_bps" integer,
	"reimbursable_cost_categories" jsonb,
	"fee_applies_to_subs" boolean,
	"fee_applies_to_change_orders" boolean,
	"contract_snapshot_markdown" text NOT NULL,
	"contract_snapshot_generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" uuid,
	"locked_by_draw_item_id" uuid,
	"lock_reason" varchar(80),
	"configured_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_terms_workspace_id_project_id_unique" UNIQUE("workspace_id","project_id"),
	CONSTRAINT "agreement_terms_commercial_model_check" CHECK ("agreement_terms"."commercial_model" in ('lump_sum', 'cost_plus', 'remeasured')),
	CONSTRAINT "agreement_terms_currency_check" CHECK ("agreement_terms"."currency" in ('SAR', 'EGP')),
	CONSTRAINT "agreement_terms_disclosure_depth_check" CHECK ("agreement_terms"."disclosure_depth" in ('none', 'category', 'line')),
	CONSTRAINT "agreement_terms_billing_cycle_check" CHECK ("agreement_terms"."billing_cycle" in ('milestone', 'monthly', 'biweekly')),
	CONSTRAINT "agreement_terms_fee_basis_check" CHECK ("agreement_terms"."fee_basis" is null or "agreement_terms"."fee_basis" in ('percentage', 'fixed')),
	CONSTRAINT "agreement_terms_retention_percentage_check" CHECK ("agreement_terms"."retention_percentage" >= 0 and "agreement_terms"."retention_percentage" <= 100),
	CONSTRAINT "agreement_terms_basis_points_check" CHECK (("agreement_terms"."fee_percentage_bps" is null or ("agreement_terms"."fee_percentage_bps" >= 0 and "agreement_terms"."fee_percentage_bps" <= 10000)) and ("agreement_terms"."savings_split_contractor_bps" is null or ("agreement_terms"."savings_split_contractor_bps" >= 0 and "agreement_terms"."savings_split_contractor_bps" <= 10000))),
	CONSTRAINT "agreement_terms_minor_units_non_negative_check" CHECK (("agreement_terms"."contract_value_minor" is null or "agreement_terms"."contract_value_minor" >= 0) and ("agreement_terms"."fee_amount_minor" is null or "agreement_terms"."fee_amount_minor" >= 0) and ("agreement_terms"."target_cost_minor" is null or "agreement_terms"."target_cost_minor" >= 0) and ("agreement_terms"."gmp_ceiling_minor" is null or "agreement_terms"."gmp_ceiling_minor" >= 0)),
	CONSTRAINT "agreement_terms_reimbursable_categories_shape_check" CHECK ("agreement_terms"."reimbursable_cost_categories" is null or agreement_terms_reimbursable_categories_valid("agreement_terms"."reimbursable_cost_categories")),
	CONSTRAINT "agreement_terms_lock_reason_check" CHECK ("agreement_terms"."lock_reason" is null or "agreement_terms"."lock_reason" in ('first_draw_item_approved')),
	CONSTRAINT "agreement_terms_fee_value_shape_check" CHECK (("agreement_terms"."fee_basis" is null and "agreement_terms"."fee_percentage_bps" is null and "agreement_terms"."fee_amount_minor" is null) or ("agreement_terms"."fee_basis" = 'percentage' and "agreement_terms"."fee_percentage_bps" is not null and "agreement_terms"."fee_amount_minor" is null) or ("agreement_terms"."fee_basis" = 'fixed' and "agreement_terms"."fee_amount_minor" is not null and "agreement_terms"."fee_percentage_bps" is null)),
	CONSTRAINT "agreement_terms_lump_sum_shape_check" CHECK ("agreement_terms"."commercial_model" <> 'lump_sum' or ("agreement_terms"."contract_value_minor" is not null and "agreement_terms"."fee_basis" is null and "agreement_terms"."fee_percentage_bps" is null and "agreement_terms"."fee_amount_minor" is null and "agreement_terms"."target_cost_minor" is null and "agreement_terms"."gmp_ceiling_minor" is null and "agreement_terms"."savings_split_contractor_bps" is null and "agreement_terms"."reimbursable_cost_categories" is null and "agreement_terms"."fee_applies_to_subs" is null and "agreement_terms"."fee_applies_to_change_orders" is null)),
	CONSTRAINT "agreement_terms_cost_plus_shape_check" CHECK ("agreement_terms"."commercial_model" <> 'cost_plus' or ("agreement_terms"."contract_value_minor" is null and "agreement_terms"."fee_basis" is not null and "agreement_terms"."reimbursable_cost_categories" is not null and "agreement_terms"."fee_applies_to_subs" is not null and "agreement_terms"."fee_applies_to_change_orders" is not null and (("agreement_terms"."gmp_ceiling_minor" is null and "agreement_terms"."savings_split_contractor_bps" is null) or ("agreement_terms"."gmp_ceiling_minor" is not null and "agreement_terms"."savings_split_contractor_bps" is not null)))),
	CONSTRAINT "agreement_terms_remeasured_shape_check" CHECK ("agreement_terms"."commercial_model" <> 'remeasured' or ("agreement_terms"."fee_basis" is not null and "agreement_terms"."contract_value_minor" is null and "agreement_terms"."target_cost_minor" is null and "agreement_terms"."gmp_ceiling_minor" is null and "agreement_terms"."savings_split_contractor_bps" is null and "agreement_terms"."reimbursable_cost_categories" is null and "agreement_terms"."fee_applies_to_subs" is null and "agreement_terms"."fee_applies_to_change_orders" is null))
);
--> statement-breakpoint
ALTER TABLE "agreement_terms" ADD CONSTRAINT "agreement_terms_workspace_id_workspace_refs_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_refs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_terms" ADD CONSTRAINT "agreement_terms_locked_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_terms" ADD CONSTRAINT "agreement_terms_configured_by_user_id_inframodern_user_refs_id_fk" FOREIGN KEY ("configured_by_user_id") REFERENCES "public"."inframodern_user_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_terms" ADD CONSTRAINT "agreement_terms_workspace_id_project_id_projects_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agreement_terms_workspace_project_idx" ON "agreement_terms" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "agreement_terms_workspace_locked_at_idx" ON "agreement_terms" USING btree ("workspace_id","locked_at");
