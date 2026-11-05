CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`record_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`owner`, `key`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`created_at` text NOT NULL,
	`count` integer NOT NULL
);
