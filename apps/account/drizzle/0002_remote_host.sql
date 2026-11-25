CREATE TABLE "remote_host" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"host_id" text NOT NULL,
	"code" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remote_host" ADD CONSTRAINT "remote_host_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_host" ADD CONSTRAINT "remote_host_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remote_host_user_idx" ON "remote_host" USING btree ("user_id");