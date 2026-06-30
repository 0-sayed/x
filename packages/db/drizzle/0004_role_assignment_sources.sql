ALTER TABLE "user_role_assignments" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_workspace_id_user_id_role_id_pk";--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_workspace_id_user_id_role_id_source_pk" PRIMARY KEY("workspace_id","user_id","role_id","source");--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_source_check" CHECK ("user_role_assignments"."source" IN ('manual', 'inframodern_admin'));
