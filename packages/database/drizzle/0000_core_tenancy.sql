CREATE TYPE "public"."idempotency_status" AS ENUM('in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."workspace_avatar_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'manager', 'support', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_status" AS ENUM('active', 'invited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"actor_avatar_account_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"correlation_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avatar_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avatar_uuid" uuid NOT NULL,
	"display_name" text,
	"legacy_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" "idempotency_status" DEFAULT 'in_progress' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"display_name" text,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_avatar_accounts" (
	"workspace_id" uuid NOT NULL,
	"avatar_account_id" uuid NOT NULL,
	"linked_by_user_id" uuid NOT NULL,
	"status" "workspace_avatar_status" DEFAULT 'active' NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "workspace_avatar_accounts_pk" PRIMARY KEY("workspace_id","avatar_account_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_member_role" NOT NULL,
	"status" "workspace_member_status" DEFAULT 'invited' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "workspace_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_avatar_account_id_avatar_accounts_id_fk" FOREIGN KEY ("actor_avatar_account_id") REFERENCES "public"."avatar_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_avatar_accounts" ADD CONSTRAINT "workspace_avatar_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_avatar_accounts" ADD CONSTRAINT "workspace_avatar_accounts_avatar_account_id_avatar_accounts_id_fk" FOREIGN KEY ("avatar_account_id") REFERENCES "public"."avatar_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_avatar_accounts" ADD CONSTRAINT "workspace_avatar_accounts_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_created_idx" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_accounts_avatar_uuid_unique" ON "avatar_accounts" USING btree ("avatar_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_workspace_scope_key_unique" ON "idempotency_records" USING btree ("workspace_id","scope","key_hash");--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "workspace_avatar_accounts_workspace_status_idx" ON "workspace_avatar_accounts" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspaces_created_by_user_idx" ON "workspaces" USING btree ("created_by_user_id");
