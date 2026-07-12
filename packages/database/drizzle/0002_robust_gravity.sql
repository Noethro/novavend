CREATE TYPE "public"."avatar_pairing_status" AS ENUM('pending', 'claimed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "avatar_pairing_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "avatar_pairing_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"claimed_avatar_account_id" uuid,
	"claimed_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_pairing_challenges_state_check" CHECK (("avatar_pairing_challenges"."status" = 'pending' and "avatar_pairing_challenges"."claimed_at" is null and "avatar_pairing_challenges"."cancelled_at" is null and "avatar_pairing_challenges"."claimed_avatar_account_id" is null and "avatar_pairing_challenges"."claimed_message_id" is null)
        or ("avatar_pairing_challenges"."status" = 'claimed' and "avatar_pairing_challenges"."claimed_at" is not null and "avatar_pairing_challenges"."cancelled_at" is null and "avatar_pairing_challenges"."claimed_avatar_account_id" is not null and "avatar_pairing_challenges"."claimed_message_id" is not null)
        or ("avatar_pairing_challenges"."status" = 'cancelled' and "avatar_pairing_challenges"."cancelled_at" is not null and "avatar_pairing_challenges"."claimed_at" is null and "avatar_pairing_challenges"."claimed_avatar_account_id" is null and "avatar_pairing_challenges"."claimed_message_id" is null)
        or ("avatar_pairing_challenges"."status" = 'expired' and "avatar_pairing_challenges"."claimed_at" is null and "avatar_pairing_challenges"."cancelled_at" is null and "avatar_pairing_challenges"."claimed_avatar_account_id" is null and "avatar_pairing_challenges"."claimed_message_id" is null))
);
--> statement-breakpoint
ALTER TABLE "avatar_pairing_challenges" ADD CONSTRAINT "avatar_pairing_challenges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "avatar_pairing_challenges" ADD CONSTRAINT "avatar_pairing_challenges_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "avatar_pairing_challenges" ADD CONSTRAINT "avatar_pairing_challenges_claimed_avatar_account_id_avatar_accounts_id_fk" FOREIGN KEY ("claimed_avatar_account_id") REFERENCES "public"."avatar_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_pairing_challenges_token_hash_unique" ON "avatar_pairing_challenges" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_pairing_challenges_message_unique" ON "avatar_pairing_challenges" USING btree ("claimed_message_id") WHERE "avatar_pairing_challenges"."claimed_message_id" is not null;--> statement-breakpoint
CREATE INDEX "avatar_pairing_challenges_workspace_status_expiry_idx" ON "avatar_pairing_challenges" USING btree ("workspace_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "avatar_pairing_challenges_expiry_idx" ON "avatar_pairing_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "avatar_pairing_challenges_claimed_avatar_idx" ON "avatar_pairing_challenges" USING btree ("claimed_avatar_account_id");