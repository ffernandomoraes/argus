CREATE TABLE "github_link" (
	"user_id" text PRIMARY KEY NOT NULL,
	"github_id" text NOT NULL,
	"login" text NOT NULL,
	"access_token" text NOT NULL,
	"access_expires_at" timestamp with time zone,
	"refresh_token" text,
	"refresh_expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_link" ADD CONSTRAINT "github_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;