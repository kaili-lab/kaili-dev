CREATE TABLE `ai_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `base_url` text NOT NULL,
  `key_iv` text NOT NULL,
  `key_ciphertext` text NOT NULL,
  `key_mask` text NOT NULL,
  `priority` integer NOT NULL,
  `enabled` integer NOT NULL CHECK (`enabled` IN (0, 1)),
  `data_classes_json` text NOT NULL DEFAULT '["public"]',
  `last_checked_at` text,
  `last_ok` integer CHECK (`last_ok` IS NULL OR `last_ok` IN (0, 1)),
  `last_failure` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL,
  `provider_model_id` text NOT NULL,
  `capabilities_json` text NOT NULL DEFAULT '["chat"]',
  `enabled` integer NOT NULL DEFAULT 1 CHECK (`enabled` IN (0, 1)),
  `source` text NOT NULL CHECK (`source` IN ('discovered', 'manual')),
  `created_at` text NOT NULL,
  FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE cascade,
  UNIQUE (`connection_id`, `provider_model_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_defaults` (
  `capability` text PRIMARY KEY NOT NULL,
  `model_id` text NOT NULL,
  FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_calls` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` text NOT NULL,
  `purpose` text NOT NULL,
  `connection_name` text,
  `provider_model_id` text,
  `outcome` text NOT NULL CHECK (`outcome` IN (
    'ok', 'timeout', 'network', 'redirect', 'rate-limited', 'server-error',
    'auth-failed', 'model-missing', 'bad-request', 'bad-format', 'config',
    'no-eligible-connection', 'deadline'
  )),
  `latency_ms` integer NOT NULL,
  `fell_back` integer NOT NULL CHECK (`fell_back` IN (0, 1)),
  `input_tokens` integer,
  `output_tokens` integer
);
--> statement-breakpoint
CREATE INDEX `ai_calls_created_at_idx` ON `ai_calls` (`created_at`);
