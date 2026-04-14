-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `openid` VARCHAR(64) NOT NULL,
    `unionid` VARCHAR(64) NULL,
    `nickname` VARCHAR(64) NOT NULL,
    `avatar_url` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(191) NOT NULL,
    `room_code` VARCHAR(16) NOT NULL,
    `room_name` VARCHAR(64) NOT NULL,
    `owner_user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `current_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archived_at` DATETIME(3) NULL,

    UNIQUE INDEX `rooms_room_code_key`(`room_code`),
    INDEX `idx_rooms_owner_user_id`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_members` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `display_name` VARCHAR(64) NOT NULL,
    `role` ENUM('OWNER', 'PLAYER', 'TEA') NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `is_online` BOOLEAN NOT NULL DEFAULT false,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_room_members_room_id`(`room_id`),
    UNIQUE INDEX `uniq_room_members_room_id_user_id`(`room_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_rules` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `tea_fee_type` ENUM('PERCENT', 'FULL') NOT NULL DEFAULT 'PERCENT',
    `tea_fee_percent` INTEGER NOT NULL DEFAULT 10,
    `tea_fee_full_threshold` INTEGER NOT NULL DEFAULT 10,
    `tea_fee_full_amount` INTEGER NOT NULL DEFAULT 1,
    `tea_fee_cap` INTEGER NOT NULL DEFAULT 6,
    `layout_mode` ENUM('TOP', 'LEFT') NOT NULL DEFAULT 'TOP',
    `voice_broadcast` BOOLEAN NOT NULL DEFAULT true,
    `keep_screen_on` BOOLEAN NOT NULL DEFAULT false,
    `updated_by_member_id` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `room_rules_room_id_key`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(64) NULL,
    `operator_member_id` VARCHAR(191) NULL,
    `entry_type` ENUM('SINGLE_TRANSFER', 'BATCH_TRANSFER', 'RULE_CHANGE', 'SYSTEM') NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `description` VARCHAR(512) NOT NULL,
    `room_version` INTEGER NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ledger_entries_room_id_occurred_at`(`room_id`, `occurred_at`),
    UNIQUE INDEX `uniq_ledger_entries_room_id_request_id`(`room_id`, `request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entry_items` (
    `id` VARCHAR(191) NOT NULL,
    `ledger_entry_id` VARCHAR(191) NOT NULL,
    `from_member_id` VARCHAR(191) NOT NULL,
    `to_member_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `tea_fee` INTEGER NOT NULL DEFAULT 0,
    `net_amount` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ledger_entry_items_ledger_entry_id`(`ledger_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `tea_fee_amount` INTEGER NOT NULL DEFAULT 0,
    `transfer_count` INTEGER NOT NULL DEFAULT 0,
    `total_abs_profit` INTEGER NOT NULL DEFAULT 0,
    `created_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_settlements_room_id_created_at`(`room_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlement_items` (
    `id` VARCHAR(191) NOT NULL,
    `settlement_id` VARCHAR(191) NOT NULL,
    `from_member_id` VARCHAR(191) NOT NULL,
    `to_member_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_settlement_items_settlement_id`(`settlement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `history_records` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `room_name` VARCHAR(64) NOT NULL,
    `profit` INTEGER NOT NULL,
    `summary` VARCHAR(512) NOT NULL,
    `finished_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_history_records_user_id_finished_at`(`user_id`, `finished_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(64) NOT NULL,
    `room_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `action_type` ENUM('CREATE_ROOM', 'JOIN_ROOM', 'SINGLE_ACCOUNTING', 'BATCH_ACCOUNTING', 'UPDATE_RULE', 'ARCHIVE_ROOM') NOT NULL,
    `response_snapshot` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_idempotency_records_user_id_action_type`(`user_id`, `action_type`),
    UNIQUE INDEX `uniq_idempotency_records_request_id`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_members` ADD CONSTRAINT `room_members_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_members` ADD CONSTRAINT `room_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_rules` ADD CONSTRAINT `room_rules_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_operator_member_id_fkey` FOREIGN KEY (`operator_member_id`) REFERENCES `room_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entry_items` ADD CONSTRAINT `ledger_entry_items_ledger_entry_id_fkey` FOREIGN KEY (`ledger_entry_id`) REFERENCES `ledger_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entry_items` ADD CONSTRAINT `ledger_entry_items_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `room_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entry_items` ADD CONSTRAINT `ledger_entry_items_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `room_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `room_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_items` ADD CONSTRAINT `settlement_items_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `room_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `history_records` ADD CONSTRAINT `history_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `history_records` ADD CONSTRAINT `history_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
