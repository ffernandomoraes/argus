CREATE TABLE "device_workspaces" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_file" (
	"user_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claude_file_user_id_path_pk" PRIMARY KEY("user_id","path")
);
--> statement-breakpoint
ALTER TABLE "device_workspaces" ADD CONSTRAINT "device_workspaces_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_workspaces" ADD CONSTRAINT "device_workspaces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_file" ADD CONSTRAINT "claude_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_workspaces_user_idx" ON "device_workspaces" USING btree ("user_id");