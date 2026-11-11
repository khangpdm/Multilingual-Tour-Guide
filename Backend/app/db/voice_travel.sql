-- ============================================================================
-- Voice Travel - MySQL 8.4 (InnoDB)  |  phien ban do an
-- Chay: mysql -u root -p --default-character-set=utf8mb4 < schema.sql
-- Chay lai duoc nhieu lan (xoa bang cu truoc khi tao).
-- Quy uoc: moi DATETIME la gio UTC (server chay --default-time-zone='+00:00').
-- ============================================================================
CREATE DATABASE IF NOT EXISTS voice_travel_test
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE voice_travel_test;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS offline_pack_languages;
DROP TABLE IF EXISTS offline_pack_releases;
DROP TABLE IF EXISTS offline_packs; -- tuong thich khi chuyen tu schema cu
DROP TABLE IF EXISTS poi_density_hourly;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS audio_tasks;
DROP TABLE IF EXISTS poi_content;
DROP TABLE IF EXISTS poi;
DROP TABLE IF EXISTS zone;
DROP TABLE IF EXISTS languages;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- Luu y chung: id khong bao giay doi nen KHONG dung ON UPDATE CASCADE.
-- (MySQL cam CHECK tren cot nam trong FK co hanh dong CASCADE / SET NULL.)

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
    id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    level TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '3 super_admin, 2 admin, 1 poi_manager, 0 user',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name),

    CONSTRAINT chk_roles_level CHECK (level BETWEEN 0 AND 3)
) ENGINE = InnoDB;


CREATE TABLE permissions (
    id VARCHAR(100) NOT NULL,
    domain VARCHAR(50) NOT NULL,

    PRIMARY KEY (id)
) ENGINE = InnoDB;


CREATE TABLE users (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ACTIVATION',
    pii_encrypted TEXT,

    invite_token_hash CHAR(64) NULL COMMENT 'sha256 cua token moi, xoa khi kich hoat',
    invite_expires_at DATETIME(3) NULL,
    last_login_at DATETIME(3) NULL,
    deactivated_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_invite_token (invite_token_hash),
    KEY idx_users_role_id (role_id),
    KEY idx_users_status (status),

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_users_status
        CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'DEACTIVATED')),

    -- du khach la khai niem, khong co tai khoan trong DB
    CONSTRAINT chk_users_not_guest_role CHECK (role_id <> 'user'),

    CONSTRAINT chk_users_deactivated_at
        CHECK ((status = 'DEACTIVATED') = (deactivated_at IS NOT NULL))
) ENGINE = InnoDB;


CREATE TABLE role_permissions (
    role_id VARCHAR(50) NOT NULL,
    permission_id VARCHAR(100) NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- Ngon ngu: 'vi' khong duoc tat; dung 1 ngon ngu mac dinh.
-- Khi doi mac dinh: bo co cu TRUOC (1 UPDATE), dat co moi SAU (1 UPDATE khac).
-- ---------------------------------------------------------------------------
CREATE TABLE languages (
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,

    default_language_guard TINYINT
        GENERATED ALWAYS AS (
            CASE WHEN is_default = TRUE THEN 1 ELSE NULL END
        ) STORED,

    PRIMARY KEY (code),

    UNIQUE KEY uq_languages_one_default (default_language_guard),

    CONSTRAINT chk_languages_display_order
        CHECK (display_order >= 0),

    CONSTRAINT chk_default_language_active
        CHECK (is_default = FALSE OR is_active = TRUE),

    CONSTRAINT chk_vi_always_active
        CHECK (code <> 'vi' OR is_active = TRUE)
) ENGINE = InnoDB;


CREATE TABLE zone (
    id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,

    min_lng DECIMAL(10,7) NOT NULL,
    min_lat DECIMAL(10,7) NOT NULL,
    max_lng DECIMAL(10,7) NOT NULL,
    max_lat DECIMAL(10,7) NOT NULL,

    min_zoom INT NOT NULL,
    max_zoom INT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_zone_name (name),

    CONSTRAINT chk_zone_longitude
        CHECK (
            min_lng >= -180 AND max_lng <= 180
            AND min_lng < max_lng
        ),

    CONSTRAINT chk_zone_latitude
        CHECK (
            min_lat >= -90 AND max_lat <= 90
            AND min_lat < max_lat
        ),

    -- khung zone toi da 1 do moi chieu (spec Z2: BBOX_TOO_LARGE)
    CONSTRAINT chk_zone_size
        CHECK (max_lng - min_lng <= 1 AND max_lat - min_lat <= 1),

    CONSTRAINT chk_zone_zoom
        CHECK (
            min_zoom >= 0
            AND max_zoom <= 24
            AND min_zoom <= max_zoom
        )
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- POI: trang thai chi co 'active' / 'inactive'
-- ---------------------------------------------------------------------------
CREATE TABLE poi (
    id CHAR(36) NOT NULL,
    zone_id CHAR(36) NOT NULL,

    category VARCHAR(100) NOT NULL,

    -- Toa do dia ly: luon viet POINT(kinh_do vi_do) kem 'axis-order=long-lat'
    location POINT NOT NULL SRID 4326,

    radius INT NOT NULL DEFAULT 30 COMMENT 'ban kinh geofence, don vi met',

    -- NULL = chua gan ma QR (nhieu dong NULL van hop le voi UNIQUE)
    qr_code VARCHAR(255) NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    images JSON COMMENT 'mang duong dan anh, toi da 10',

    last_modified_by CHAR(36) NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_poi_qr_code (qr_code),

    KEY idx_poi_zone_id (zone_id),
    KEY idx_poi_status_updated (status, updated_at),   -- Delta Sync
    KEY idx_poi_last_modified_by (last_modified_by),

    SPATIAL INDEX idx_poi_location (location),

    CONSTRAINT fk_poi_zone
        FOREIGN KEY (zone_id)
        REFERENCES zone(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_poi_last_modified_by
        FOREIGN KEY (last_modified_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_poi_radius
        CHECK (radius BETWEEN 10 AND 200),

    CONSTRAINT chk_poi_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT chk_poi_images
        CHECK (images IS NULL OR (JSON_TYPE(images) = 'ARRAY' AND JSON_LENGTH(images) <= 10))
) ENGINE = InnoDB;


-- Mot dong cho moi (POI, ngon ngu)
CREATE TABLE poi_content (
    poi_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,

    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    description TEXT,
    text TEXT NOT NULL COMMENT 'kich ban dung de tao giong noi',

    is_edited BOOLEAN NOT NULL DEFAULT FALSE,

    audio_url VARCHAR(500),
    audio_sha256 CHAR(64),
    audio_source VARCHAR(20) COMMENT 'TTS | UPLOADED (UPLOADED khong bi TTS ghi de)',

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (poi_id, language_code),

    KEY idx_poi_content_language (language_code),

    CONSTRAINT fk_poi_content_poi
        FOREIGN KEY (poi_id)
        REFERENCES poi(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_poi_content_language
        FOREIGN KEY (language_code)
        REFERENCES languages(code)
        ON DELETE RESTRICT,

    -- ban tieng Viet (ngon ngu goc) bat buoc co chu; ban dich co the rong tam thoi
    CONSTRAINT chk_poi_content_vi_required
        CHECK (language_code <> 'vi' OR (CHAR_LENGTH(name) >= 1 AND CHAR_LENGTH(text) >= 1)),

    -- audio_url va audio_sha256 luon di cung nhau; co audio thi phai biet nguon
    CONSTRAINT chk_poi_content_audio_pair
        CHECK ((audio_url IS NULL) = (audio_sha256 IS NULL)),

    CONSTRAINT chk_poi_content_audio_source
        CHECK (
            (audio_url IS NULL OR audio_source IS NOT NULL)
            AND (audio_source IS NULL OR audio_source IN ('TTS', 'UPLOADED'))
        )
) ENGINE = InnoDB;


-- Hang doi dich + TTS. FK tro rieng vao poi va languages (khong tro vao poi_content)
-- vi chinh task dich la thu tao ra dong poi_content cua ngon ngu dich.
-- created_by = NULL  <=>  task do du khach goi.
CREATE TABLE audio_tasks (
    id CHAR(36) NOT NULL,
    poi_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,

    state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',

    progress INT NOT NULL DEFAULT 0,

    error TEXT,

    retry_count INT NOT NULL DEFAULT 0,

    options JSON COMMENT '{"retranslate":false,"replace_uploaded_audio":false}',

    created_by CHAR(36),

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    started_at DATETIME(3),
    finished_at DATETIME(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    -- toi da 1 task QUEUED/PROCESSING cho moi (POI, ngon ngu)
    active_flag TINYINT
        GENERATED ALWAYS AS (
            CASE WHEN state IN ('QUEUED', 'PROCESSING') THEN 1 ELSE NULL END
        ) STORED,

    PRIMARY KEY (id),

    UNIQUE KEY uq_audio_tasks_active (poi_id, language_code, active_flag),

    KEY idx_audio_tasks_language (language_code),
    KEY idx_audio_tasks_created_by (created_by),
    KEY idx_audio_tasks_state_created (state, created_at),

    CONSTRAINT fk_audio_tasks_poi
        FOREIGN KEY (poi_id)
        REFERENCES poi(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_audio_tasks_language
        FOREIGN KEY (language_code)
        REFERENCES languages(code)
        ON DELETE RESTRICT,

    CONSTRAINT fk_audio_tasks_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_audio_tasks_state
        CHECK (state IN (
            'QUEUED',
            'PROCESSING',
            'COMPLETED',
            'FAILED',
            'CANCELLED'
        )),

    CONSTRAINT chk_audio_tasks_progress
        CHECK (progress BETWEEN 0 AND 100),

    CONSTRAINT chk_audio_tasks_retry
        CHECK (retry_count >= 0),

    CONSTRAINT chk_audio_tasks_timestamps
        CHECK (
            finished_at IS NULL
            OR started_at IS NULL
            OR finished_at >= started_at
        ),

    CONSTRAINT chk_audio_tasks_processing
        CHECK (state <> 'PROCESSING' OR started_at IS NOT NULL),

    CONSTRAINT chk_audio_tasks_completed
        CHECK (state <> 'COMPLETED' OR progress = 100)
) ENGINE = InnoDB;


CREATE TABLE audit_logs (
    id CHAR(36) NOT NULL,
    actor_user_id CHAR(36) NOT NULL,

    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NULL,

    before_data JSON,
    after_data JSON,

    ip_hash CHAR(64),

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    KEY idx_audit_actor_created (actor_user_id, created_at),
    KEY idx_audit_target (target_id),
    KEY idx_audit_action (action),
    KEY idx_audit_created_at (created_at),

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE = InnoDB;


-- Bang ghi nhieu nhat: id so tu tang (nhe hon UUID 36 ky tu o moi index).
CREATE TABLE analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    client_event_id CHAR(36) NOT NULL COMMENT 'UUID do app tao, chong ghi trung',
    event_type VARCHAR(30) NOT NULL,
    poi_id CHAR(36),
    zone_id CHAR(36),
    language_code VARCHAR(10),
    trigger_source VARCHAR(30),
    audio_tier VARCHAR(20),
    device_id CHAR(36) NOT NULL,
    occurred_at DATETIME(3) NOT NULL,
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_analytics_client_event (client_event_id),

    KEY idx_analytics_poi_time (poi_id, occurred_at),
    KEY idx_analytics_event_type_time (event_type, occurred_at),
    KEY idx_analytics_device_time (device_id, occurred_at),
    KEY idx_analytics_received_at (received_at),     -- job xoa du lieu cu (>90 ngay)

    CONSTRAINT fk_analytics_poi
        FOREIGN KEY (poi_id)
        REFERENCES poi(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_analytics_zone
        FOREIGN KEY (zone_id)
        REFERENCES zone(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_analytics_language
        FOREIGN KEY (language_code)
        REFERENCES languages(code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_analytics_event_type
        CHECK (event_type IN (
            'AUDIO_PLAY',
            'QR_SCAN',
            'PACK_DOWNLOAD'
        )),

    CONSTRAINT chk_analytics_trigger_source
        CHECK (
            trigger_source IS NULL
            OR trigger_source IN (
                'geofence',
                'qr_scan',
                'manual_tap'
            )
        ),

    CONSTRAINT chk_analytics_audio_tier
        CHECK (
            audio_tier IS NULL
            OR audio_tier IN (
                'tier1',
                'tier1_5',
                'tier2',
                'tier3'
            )
        ),

    -- thay cho 2 trigger cu: PACK_DOWNLOAD can zone_id; AUDIO_PLAY/QR_SCAN can poi_id
    CONSTRAINT chk_analytics_refs
        CHECK (
            (event_type = 'PACK_DOWNLOAD' AND zone_id IS NOT NULL AND poi_id IS NULL)
            OR (event_type IN ('AUDIO_PLAY', 'QR_SCAN') AND poi_id IS NOT NULL AND zone_id IS NULL)
        ),

    CONSTRAINT chk_analytics_audio_play
        CHECK (
            event_type <> 'AUDIO_PLAY'
            OR (trigger_source IS NOT NULL AND audio_tier IS NOT NULL)
        )
) ENGINE = InnoDB;


-- Ghi: INSERT ... ON DUPLICATE KEY UPDATE visit_count = visit_count + 1
CREATE TABLE poi_density_hourly (
    poi_id CHAR(36) NOT NULL,

    hour_bucket DATETIME NOT NULL COMMENT 'dau gio UTC',

    visit_count INT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (poi_id, hour_bucket),

    KEY idx_poi_density_hour (hour_bucket),

    CONSTRAINT fk_poi_density_poi
        FOREIGN KEY (poi_id)
        REFERENCES poi(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_poi_density_hour
        CHECK (MINUTE(hour_bucket) = 0 AND SECOND(hour_bucket) = 0)
) ENGINE = InnoDB;


-- ---------------------------------------------------------------------------
-- OFFLINE PACKS
-- Mot release chung cho moi Zone + cac shard ngon ngu doc lap.
-- Common pack: POI metadata, toa do, category, QR, images.
-- Language shard: name, address, description, text, audio cua tung ngon ngu.
-- Client co the tai them language shard ma khong tai lai common pack.
-- ---------------------------------------------------------------------------

CREATE TABLE offline_pack_releases (
    id CHAR(36) NOT NULL,
    zone_id CHAR(36) NOT NULL,
    version INT NOT NULL,

    common_file_url VARCHAR(500),
    common_sha256 CHAR(64),
    common_size_bytes BIGINT UNSIGNED,

    status VARCHAR(20) NOT NULL DEFAULT 'building',
    -- building: dang tao; ready: build xong, chua publish;
    -- published: ban hien hanh; superseded: da bi ban moi thay the; failed: that bai.

    created_by CHAR(36) NOT NULL,
    published_by CHAR(36),
    built_at DATETIME(3),
    published_at DATETIME(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    -- Moi Zone chi co toi da mot release dang published.
    published_zone_id CHAR(36)
        GENERATED ALWAYS AS (
            CASE WHEN status = 'published' THEN zone_id ELSE NULL END
        ) STORED,

    PRIMARY KEY (id),
    UNIQUE KEY uq_offline_release_zone_version (zone_id, version),
    UNIQUE KEY uq_offline_release_one_published (published_zone_id),
    KEY idx_offline_release_status (status),

    CONSTRAINT fk_offline_release_zone
        FOREIGN KEY (zone_id)
        REFERENCES zone(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_offline_release_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_offline_release_published_by
        FOREIGN KEY (published_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_offline_release_status
        CHECK (status IN ('building', 'ready', 'published', 'superseded', 'failed')),

    CONSTRAINT chk_offline_release_version
        CHECK (version > 0),

    CONSTRAINT chk_offline_release_common_file
        CHECK (
            (common_file_url IS NULL AND common_sha256 IS NULL AND common_size_bytes IS NULL)
            OR
            (common_file_url IS NOT NULL AND common_sha256 IS NOT NULL
             AND common_size_bytes > 0)
        ),

    CONSTRAINT chk_offline_release_built_fields
        CHECK (
            status NOT IN ('ready', 'published')
            OR (common_file_url IS NOT NULL AND common_sha256 IS NOT NULL
                AND common_size_bytes > 0 AND built_at IS NOT NULL)
        ),

    CONSTRAINT chk_offline_release_published_fields
        CHECK (
            status <> 'published'
            OR (published_by IS NOT NULL AND published_at IS NOT NULL)
        )
) ENGINE = InnoDB;


CREATE TABLE offline_pack_languages (
    id CHAR(36) NOT NULL,
    release_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,

    file_url VARCHAR(500),
    sha256 CHAR(64),
    size_bytes BIGINT UNSIGNED,

    status VARCHAR(20) NOT NULL DEFAULT 'building',
    -- building, ready, failed
    built_at DATETIME(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_offline_pack_language (release_id, language_code),
    KEY idx_offline_pack_language_status (status),

    CONSTRAINT fk_offline_pack_language_release
        FOREIGN KEY (release_id)
        REFERENCES offline_pack_releases(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_offline_pack_language_code
        FOREIGN KEY (language_code)
        REFERENCES languages(code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_offline_pack_language_status
        CHECK (status IN ('building', 'ready', 'failed')),

    CONSTRAINT chk_offline_pack_language_file
        CHECK (
            (file_url IS NULL AND sha256 IS NULL AND size_bytes IS NULL)
            OR
            (file_url IS NOT NULL AND sha256 IS NOT NULL AND size_bytes > 0)
        ),

    CONSTRAINT chk_offline_pack_language_ready
        CHECK (status <> 'ready' OR (file_url IS NOT NULL AND built_at IS NOT NULL))
) ENGINE = InnoDB;


-- ---------------------------------------------------------------------------
-- Trigger: giu poi.updated_at dung cho Delta Sync. Sua noi dung POI thi
-- poi.updated_at phai tang, neu khong app mobile khong bao gio thay ban sua.
-- (Anh nam trong cot poi.images nen sua anh tu tang updated_at.)
-- DELIMITER la lenh cua client mysql/Workbench; chay qua driver thi tach tung trigger.
-- ---------------------------------------------------------------------------
DELIMITER //

CREATE TRIGGER trg_poi_content_ai
AFTER INSERT ON poi_content
FOR EACH ROW
BEGIN
    UPDATE poi SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = NEW.poi_id;
END//

CREATE TRIGGER trg_poi_content_au
AFTER UPDATE ON poi_content
FOR EACH ROW
BEGIN
    UPDATE poi SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = NEW.poi_id;
END//

DELIMITER ;