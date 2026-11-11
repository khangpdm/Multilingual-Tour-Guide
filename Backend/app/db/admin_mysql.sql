CREATE TABLE IF NOT EXISTS roles (id VARCHAR(50) NOT NULL PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE,level TINYINT UNSIGNED NOT NULL DEFAULT 0,is_system BOOLEAN NOT NULL DEFAULT FALSE,CHECK (level BETWEEN 0 AND 3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS permissions (id VARCHAR(100) NOT NULL PRIMARY KEY,domain VARCHAR(50) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS users (id CHAR(36) NOT NULL PRIMARY KEY,email VARCHAR(255) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,password_salt CHAR(32) NULL,full_name VARCHAR(255) NULL,role_id VARCHAR(50) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ACTIVATION',pii_encrypted TEXT NULL,invite_token_hash CHAR(64) NULL UNIQUE,invite_expires_at DATETIME(3) NULL,last_login_at DATETIME(3) NULL,deactivated_at DATETIME(3) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),KEY idx_users_role_id (role_id),CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','DEACTIVATED'))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS role_permissions (role_id VARCHAR(50) NOT NULL,permission_id VARCHAR(100) NOT NULL,PRIMARY KEY (role_id,permission_id),FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS languages (code VARCHAR(10) NOT NULL PRIMARY KEY,name VARCHAR(100) NOT NULL,native_name VARCHAR(100) NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,is_default BOOLEAN NOT NULL DEFAULT FALSE,display_order INT NOT NULL DEFAULT 0,default_language_guard TINYINT GENERATED ALWAYS AS (CASE WHEN is_default THEN 1 ELSE NULL END) STORED UNIQUE,CHECK (is_default=FALSE OR is_active=TRUE),CHECK (code<>'vi' OR is_active=TRUE)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS zone (id CHAR(36) NOT NULL PRIMARY KEY,name VARCHAR(255) NOT NULL UNIQUE,min_lng DECIMAL(10,7) NOT NULL,min_lat DECIMAL(10,7) NOT NULL,max_lng DECIMAL(10,7) NOT NULL,max_lat DECIMAL(10,7) NOT NULL,min_zoom INT NOT NULL,max_zoom INT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),CHECK (min_lng>=-180 AND max_lng<=180 AND min_lng<max_lng),CHECK (min_lat>=-90 AND max_lat<=90 AND min_lat<max_lat),CHECK (min_zoom>=0 AND max_zoom<=24 AND min_zoom<=max_zoom)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS poi (id CHAR(36) NOT NULL PRIMARY KEY,zone_id CHAR(36) NOT NULL,category VARCHAR(100) NOT NULL,location POINT NOT NULL SRID 4326,radius INT NOT NULL DEFAULT 30,qr_code VARCHAR(255) NULL UNIQUE,status VARCHAR(20) NOT NULL DEFAULT 'active',is_archived BOOLEAN NOT NULL DEFAULT FALSE,unpublish_reason VARCHAR(500) NULL,images JSON NULL,last_modified_by CHAR(36) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),KEY idx_poi_zone_id (zone_id),KEY idx_poi_status_updated (status,updated_at),SPATIAL INDEX idx_poi_location (location),FOREIGN KEY (zone_id) REFERENCES zone(id),FOREIGN KEY (last_modified_by) REFERENCES users(id),CHECK (radius BETWEEN 10 AND 200),CHECK (status IN ('active','inactive')),CHECK (images IS NULL OR (JSON_TYPE(images)='ARRAY' AND JSON_LENGTH(images)<=10))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS poi_content (poi_id CHAR(36) NOT NULL,language_code VARCHAR(10) NOT NULL,name VARCHAR(255) NOT NULL,address VARCHAR(500) NULL,description TEXT NULL,text TEXT NOT NULL,is_edited BOOLEAN NOT NULL DEFAULT FALSE,audio_url VARCHAR(500) NULL,audio_sha256 CHAR(64) NULL,audio_source VARCHAR(20) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),PRIMARY KEY (poi_id,language_code),FOREIGN KEY (poi_id) REFERENCES poi(id),FOREIGN KEY (language_code) REFERENCES languages(code),CHECK ((audio_url IS NULL)=(audio_sha256 IS NULL)),CHECK ((audio_url IS NULL OR audio_source IS NOT NULL) AND (audio_source IS NULL OR audio_source IN ('TTS','UPLOADED')))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS audit_logs (id CHAR(36) NOT NULL PRIMARY KEY,actor_user_id CHAR(36) NOT NULL,action VARCHAR(100) NOT NULL,target_id VARCHAR(100) NULL,before_data JSON NULL,after_data JSON NULL,ip_hash CHAR(64) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),KEY idx_audit_actor_created (actor_user_id,created_at),KEY idx_audit_target (target_id),KEY idx_audit_action (action),FOREIGN KEY (actor_user_id) REFERENCES users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash CHAR(64) NOT NULL PRIMARY KEY,user_id CHAR(36) NOT NULL,expires_at DATETIME(3) NOT NULL,KEY idx_admin_sessions_expiry (expires_at),FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audio_tasks (
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

CREATE TABLE IF NOT EXISTS analytics_events (
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

CREATE TABLE IF NOT EXISTS poi_density_hourly (
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

CREATE TABLE IF NOT EXISTS offline_pack_releases (
    id CHAR(36) NOT NULL,
    zone_id CHAR(36) NOT NULL,
    version INT NOT NULL,

    common_file_url VARCHAR(500),
    common_sha256 CHAR(64),
    common_size_bytes BIGINT UNSIGNED,

    status VARCHAR(20) NOT NULL DEFAULT 'building',

    created_by CHAR(36) NOT NULL,
    published_by CHAR(36),
    built_at DATETIME(3),
    published_at DATETIME(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
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

CREATE TABLE IF NOT EXISTS offline_pack_languages (
    id CHAR(36) NOT NULL,
    release_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,

    file_url VARCHAR(500),
    sha256 CHAR(64),
    size_bytes BIGINT UNSIGNED,

    status VARCHAR(20) NOT NULL DEFAULT 'building',
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
