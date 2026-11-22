CREATE TABLE `absence_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`submitted_by` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`reviewed_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `absence_notes_student_idx` ON `absence_notes` (`student_id`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`recorded_by` text,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_student_date_idx` ON `attendance` (`student_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `attendance` (`date`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`year_level` integer NOT NULL,
	`teacher_id` text,
	`room` text,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `classes_school_idx` ON `classes` (`school_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`category` text DEFAULT 'event' NOT NULL,
	`audience_type` text NOT NULL,
	`audience_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_school_idx` ON `events` (`school_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `fete_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`description` text,
	`cause` text,
	`event_date` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`goal_cents` integer NOT NULL,
	`default_student_goal_cents` integer DEFAULT 10000 NOT NULL,
	`points_per_dollar` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fete_campaigns_slug_unique` ON `fete_campaigns` (`slug`);--> statement-breakpoint
CREATE TABLE `fete_donations` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`participant_id` text,
	`amount_cents` integer NOT NULL,
	`donor_name` text NOT NULL,
	`donor_email` text,
	`message` text,
	`anonymous` integer DEFAULT false NOT NULL,
	`method` text DEFAULT 'online' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_id` text,
	`recorded_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `fete_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `fete_participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fete_donations_campaign_idx` ON `fete_donations` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `fete_donations_participant_idx` ON `fete_donations` (`participant_id`);--> statement-breakpoint
CREATE INDEX `fete_donations_payment_idx` ON `fete_donations` (`payment_id`);--> statement-breakpoint
CREATE TABLE `fete_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`student_id` text NOT NULL,
	`code` text NOT NULL,
	`goal_cents` integer NOT NULL,
	`pitch` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `fete_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fete_participants_code_unique` ON `fete_participants` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `fete_participants_campaign_student_idx` ON `fete_participants` (`campaign_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `fete_point_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text NOT NULL,
	`awarded_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `fete_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`awarded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `fete_prize_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎁' NOT NULL,
	`threshold_cents` integer NOT NULL,
	`description` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `fete_campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guardians` (
	`user_id` text NOT NULL,
	`student_id` text NOT NULL,
	`relationship` text DEFAULT 'Parent' NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`user_id`, `student_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guardians_student_idx` ON `guardians` (`student_id`);--> statement-breakpoint
CREATE TABLE `houses` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notice_reads` (
	`notice_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer NOT NULL,
	`acknowledged_at` integer,
	PRIMARY KEY(`notice_id`, `user_id`),
	FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`audience_type` text NOT NULL,
	`audience_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`requires_ack` integer DEFAULT false NOT NULL,
	`published_at` integer NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notices_school_idx` ON `notices` (`school_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `payment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'excursion' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`requires_consent` integer DEFAULT false NOT NULL,
	`due_at` integer,
	`event_id` text,
	`audience_type` text NOT NULL,
	`audience_id` text,
	`closed` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payment_items_school_idx` ON `payment_items` (`school_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text,
	`purpose` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payer_user_id` text,
	`payer_name` text,
	`payer_email` text,
	`return_path` text DEFAULT '/' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_school_idx` ON `payments` (`school_id`);--> statement-breakpoint
CREATE TABLE `quad_members` (
	`space_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`last_read_at` integer,
	`muted` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`space_id`, `user_id`),
	FOREIGN KEY (`space_id`) REFERENCES `quad_spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quad_members_user_idx` ON `quad_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `quad_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`parent_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	`deleted_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `quad_spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quad_messages_space_idx` ON `quad_messages` (`space_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `quad_messages_parent_idx` ON `quad_messages` (`parent_id`);--> statement-breakpoint
CREATE TABLE `quad_reactions` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`, `emoji`),
	FOREIGN KEY (`message_id`) REFERENCES `quad_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quad_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `quad_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `quad_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text DEFAULT '💬' NOT NULL,
	`kind` text NOT NULL,
	`audience_type` text,
	`audience_id` text,
	`visibility` text DEFAULT 'open' NOT NULL,
	`posting_policy` text DEFAULT 'everyone' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quad_spaces_school_idx` ON `quad_spaces` (`school_id`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`slug` text NOT NULL,
	`suburb` text,
	`state` text DEFAULT 'VIC' NOT NULL,
	`timezone` text DEFAULT 'Australia/Melbourne' NOT NULL,
	`phone` text,
	`email` text,
	`abn` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_slug_unique` ON `schools` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `student_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`student_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`consent` text,
	`consent_by` text,
	`consent_at` integer,
	`payment_id` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `payment_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`consent_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_charges_item_student_idx` ON `student_charges` (`item_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `student_charges_student_idx` ON `student_charges` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_charges_payment_idx` ON `student_charges` (`payment_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`preferred_name` text,
	`class_id` text,
	`house_id` text,
	`year_level` integer NOT NULL,
	`date_of_birth` text,
	`medical_notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `students_school_idx` ON `students` (`school_id`);--> statement-breakpoint
CREATE INDEX `students_class_idx` ON `students` (`class_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);