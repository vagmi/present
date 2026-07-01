CREATE TABLE `slides` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`presentation_id` text NOT NULL,
	`position` integer NOT NULL,
	`scene` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`presentation_id`) REFERENCES `presentations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slides_org_presentation_idx` ON `slides` (`org_id`,`presentation_id`);