-- ============================================================================
-- Voice Travel - seed du lieu mau (DEV). Chay SAU schema.sql.
-- Khong tat FOREIGN_KEY_CHECKS: seed sai rang buoc thi phai bao loi.
-- Tai khoan dev (xoa truoc khi nop/trien khai that):
--   superadmin@example.com / Admin@12345     (super_admin)
--   manager1@example.com   / Manager@12345   (poi_manager)
-- Du lieu mau co 3 POI: Cho Ben Thanh (active, co audio vi, ban en dang cho),
-- Nha tho Duc Ba (active, chua co QR, dich en bi loi), Dinh Doc Lap (inactive).
-- ============================================================================
USE voice_travel_test;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- 1. permissions (32 quyen) ---------------------------------------------------
INSERT INTO permissions (id, domain) VALUES
('poi.create','poi_management'), ('poi.edit','poi_management'), ('poi.delete','poi_management'),
('poi.view','poi_management'), ('poi.assign_qr','poi_management'),
('content.unpublish','content_moderation'), ('content.restore','content_moderation'), ('content.flag','content_moderation'),
('audio.trigger_regenerate','audio_tasks'), ('audio.view_tasks','audio_tasks'),
('audio.cancel_task','audio_tasks'), ('audio.retry_task','audio_tasks'),
('user.create','user_management'), ('user.edit','user_management'),
('user.deactivate','user_management'), ('user.view','user_management'),
('role.create','role_management'), ('role.assign_permission','role_management'), ('role.view','role_management'),
('analytics.view_overview','analytics'), ('analytics.view_poi_reports','analytics'),
('analytics.view_user_reports','analytics'), ('analytics.export','analytics'),
('audit.view','audit'), ('audit.export','audit'),
('system.manage_constants','system_config'), ('system.manage_languages','system_config'),
('system.manage_integrations','system_config'),
('heatmap.view_live','heatmap_monitoring'), ('heatmap.view_trend','heatmap_monitoring'),
('heatmap.configure_zones','heatmap_monitoring'), ('heatmap.export','heatmap_monitoring');

-- 2. roles --------------------------------------------------------------------
INSERT INTO roles (id, name, level, is_system) VALUES
('super_admin', 'Super Administrator', 3, TRUE),
('admin',       'Administrator',       2, TRUE),
('poi_manager', 'POI Manager',         1, TRUE),
('user',        'Guest Tourist',       0, TRUE);

-- 3. role_permissions ---------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id) VALUES
('admin','poi.create'), ('admin','poi.edit'), ('admin','poi.delete'), ('admin','poi.view'), ('admin','poi.assign_qr'),
('admin','content.unpublish'), ('admin','content.restore'), ('admin','content.flag'),
('admin','audio.view_tasks'), ('admin','audio.cancel_task'), ('admin','audio.retry_task'),
('admin','user.view'), ('admin','user.edit'), ('admin','user.deactivate'), ('admin','role.view'),
('admin','analytics.view_overview'), ('admin','analytics.view_poi_reports'),
('admin','analytics.view_user_reports'), ('admin','analytics.export'),
('admin','audit.view'),
('admin','heatmap.view_live'), ('admin','heatmap.view_trend'),
('admin','heatmap.configure_zones'), ('admin','heatmap.export'),
('poi_manager','poi.create'), ('poi_manager','poi.edit'), ('poi_manager','poi.delete'),
('poi_manager','poi.view'), ('poi_manager','poi.assign_qr'),
('poi_manager','audio.view_tasks'), ('poi_manager','audio.retry_task'),
('poi_manager','analytics.view_poi_reports'), ('poi_manager','heatmap.view_live');

-- 4. languages ----------------------------------------------------------------
INSERT INTO languages (code, name, native_name, is_active, is_default, display_order) VALUES
('vi', 'Vietnamese', 'Tiếng Việt', TRUE, TRUE,  1),
('en', 'English',    'English',    TRUE, FALSE, 2),
('ja', 'Japanese',   '日本語',      TRUE, FALSE, 3),
('ko', 'Korean',     '한국어',      TRUE, FALSE, 4),
('zh', 'Chinese',    '中文',        TRUE, FALSE, 5);

-- 5. zone ---------------------------------------------------------------------
INSERT INTO zone (id, name, min_lng, min_lat, max_lng, max_lat, min_zoom, max_zoom, is_active) VALUES
('0191a000-0000-7000-8000-000000000001', 'Quận 1', 106.6800000, 10.7600000, 106.7200000, 10.8000000, 11, 16, TRUE);

-- 6. users --------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, role_id, status, pii_encrypted) VALUES
('0191a000-0000-7000-9000-000000000001', 'superadmin@example.com',
    '$2b$12$Iq344egAEFAeGhX8usq64.eK9Pnq22pZX1kQd/Gq7uNpNaoJc7gWW', 'super_admin', 'ACTIVE', NULL),
('0191a000-0000-7000-9000-000000000002', 'manager1@example.com',
    '$2b$12$YJtM95kMtnMfiy70N8lG4OMeSG1aVuFehaZs9yqKWpMHkG2bY4c1m', 'poi_manager', 'ACTIVE', NULL);

-- 7. poi (toa do: KINH DO truoc, VI DO sau) -----------------------------------
INSERT INTO poi (id, zone_id, category, location, radius, qr_code, status, images, last_modified_by) VALUES
('0191a000-0000-7000-a000-000000000001', '0191a000-0000-7000-8000-000000000001', 'landmark',
    ST_GeomFromText('POINT(106.6980 10.7726)', 4326, 'axis-order=long-lat'), 30, 'QR-POI-0001', 'active',
    '["/images/poi_0001/a1b2c3d4.jpg"]', '0191a000-0000-7000-9000-000000000002'),
('0191a000-0000-7000-a000-000000000002', '0191a000-0000-7000-8000-000000000001', 'landmark',
    ST_GeomFromText('POINT(106.6990 10.7798)', 4326, 'axis-order=long-lat'), 30, NULL, 'active',
    NULL, '0191a000-0000-7000-9000-000000000002'),
('0191a000-0000-7000-a000-000000000003', '0191a000-0000-7000-8000-000000000001', 'landmark',
    ST_GeomFromText('POINT(106.6955 10.7770)', 4326, 'axis-order=long-lat'), 30, NULL, 'inactive',
    NULL, '0191a000-0000-7000-9000-000000000002');

-- 8. poi_content (audio_sha256 la gia tri giu cho, chua co file mp3 that) ------
INSERT INTO poi_content (poi_id, language_code, name, address, description, text, audio_url, audio_sha256, audio_source, is_edited) VALUES
('0191a000-0000-7000-a000-000000000001', 'vi', 'Chợ Bến Thành', 'Lê Lợi, Quận 1',
    'Biểu tượng văn hóa và lịch sử nổi tiếng của Sài Gòn.',
    'Chợ Bến Thành là một trong những biểu tượng văn hóa và lịch sử nổi tiếng nhất của Thành phố Hồ Chí Minh.',
    '/audio/poi_0001/vi.mp3', SHA2('seed-placeholder:poi_0001:vi', 256), 'TTS', FALSE),
('0191a000-0000-7000-a000-000000000001', 'en', 'Ben Thanh Market', 'Le Loi, District 1',
    'A famous cultural and historical symbol of Ho Chi Minh City.',
    'Ben Thanh Market is one of the most famous cultural and historical symbols of Ho Chi Minh City.',
    NULL, NULL, 'TTS', FALSE),
('0191a000-0000-7000-a000-000000000002', 'vi', 'Nhà thờ Đức Bà', 'Công xã Paris, Quận 1',
    'Nhà thờ chính tòa nổi tiếng giữa trung tâm Sài Gòn.',
    'Nhà thờ Đức Bà là công trình kiến trúc Pháp tiêu biểu nằm ngay trung tâm Thành phố Hồ Chí Minh.',
    NULL, NULL, NULL, FALSE),
('0191a000-0000-7000-a000-000000000003', 'vi', 'Dinh Độc Lập', 'Nguyễn Du, Quận 1',
    NULL,
    'Dinh Độc Lập là nơi ghi dấu nhiều sự kiện lịch sử quan trọng của Việt Nam.',
    NULL, NULL, NULL, FALSE);

-- 9. audio_tasks --------------------------------------------------------------
INSERT INTO audio_tasks (id, poi_id, language_code, state, progress, error, retry_count, options, created_by, created_at, started_at, finished_at) VALUES
('0191a000-0000-7000-c000-000000000001', '0191a000-0000-7000-a000-000000000001', 'vi', 'COMPLETED', 100, NULL, 0,
    '{"retranslate": false, "replace_uploaded_audio": false}', '0191a000-0000-7000-9000-000000000002',
    '2026-11-04 08:00:00.000', '2026-11-04 08:00:01.000', '2026-11-04 08:00:04.000'),
('0191a000-0000-7000-c000-000000000002', '0191a000-0000-7000-a000-000000000001', 'en', 'QUEUED', 0, NULL, 0,
    '{"retranslate": false, "replace_uploaded_audio": false}', '0191a000-0000-7000-9000-000000000002',
    '2026-11-04 08:00:00.000', NULL, NULL),
('0191a000-0000-7000-c000-000000000003', '0191a000-0000-7000-a000-000000000002', 'en', 'FAILED', 40, 'TTS provider timeout', 3,
    '{"retranslate": false, "replace_uploaded_audio": false}', '0191a000-0000-7000-9000-000000000002',
    '2026-11-04 08:10:00.000', '2026-11-04 08:20:00.000', '2026-11-04 08:20:30.000');

-- 10. audit_logs --------------------------------------------------------------
INSERT INTO audit_logs (id, actor_user_id, action, target_id, before_data, after_data, ip_hash, created_at) VALUES
('0191a000-0000-7000-b000-000000000001', '0191a000-0000-7000-9000-000000000002', 'poi.create',
    '0191a000-0000-7000-a000-000000000001', NULL, '{"status": "active"}',
    SHA2(CONCAT('127.0.0.1', 'dev-salt'), 256), '2026-11-04 07:55:00.000'),
('0191a000-0000-7000-b000-000000000002', '0191a000-0000-7000-9000-000000000001', 'poi.deactivate',
    '0191a000-0000-7000-a000-000000000003', '{"status": "active"}', '{"status": "inactive"}',
    SHA2(CONCAT('127.0.0.1', 'dev-salt'), 256), '2026-11-04 09:12:00.000');

-- 11. analytics_events --------------------------------------------------------
INSERT INTO analytics_events (client_event_id, event_type, poi_id, zone_id, language_code, trigger_source, audio_tier, device_id, occurred_at, received_at) VALUES
('7b0f6e4e-3c1d-4a7a-9f6e-1a2b3c4d5e01', 'AUDIO_PLAY', '0191a000-0000-7000-a000-000000000001', NULL, 'vi', 'geofence', 'tier1',
    'a3d1c2b4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', '2026-11-04 07:20:00.000', '2026-11-04 07:20:05.000'),
('7b0f6e4e-3c1d-4a7a-9f6e-1a2b3c4d5e02', 'AUDIO_PLAY', '0191a000-0000-7000-a000-000000000001', NULL, 'vi', 'qr_scan', 'tier1',
    'b4e2d3c5-6f7a-4b8c-9d0e-1f2a3b4c5d6e', '2026-11-04 07:40:00.000', '2026-11-04 07:40:03.000'),
('7b0f6e4e-3c1d-4a7a-9f6e-1a2b3c4d5e03', 'QR_SCAN', '0191a000-0000-7000-a000-000000000001', NULL, NULL, 'qr_scan', NULL,
    'b4e2d3c5-6f7a-4b8c-9d0e-1f2a3b4c5d6e', '2026-11-04 07:39:58.000', '2026-11-04 07:40:03.000'),
('7b0f6e4e-3c1d-4a7a-9f6e-1a2b3c4d5e04', 'PACK_DOWNLOAD', NULL, '0191a000-0000-7000-8000-000000000001', 'en', NULL, NULL,
    'a3d1c2b4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', '2026-11-04 06:00:00.000', '2026-11-04 06:00:02.000');

-- 12. poi_density_hourly (gio UTC) --------------------------------------------
INSERT INTO poi_density_hourly (poi_id, hour_bucket, visit_count) VALUES
('0191a000-0000-7000-a000-000000000001', '2026-11-04 07:00:00', 86),
('0191a000-0000-7000-a000-000000000001', '2026-11-04 08:00:00', 31),
('0191a000-0000-7000-a000-000000000002', '2026-11-04 07:00:00', 3);

-- 13. Them permission quan ly Offline Pack ------------------------------------
INSERT IGNORE INTO permissions (id, domain)
VALUES ('offline_pack.manage', 'offline_pack_management');

-- Cap quyen cho cac vai tro duoc phep quan ly Offline Pack.
-- super_admin da duoc gan tat ca permission trong 2_seed.sql; INSERT IGNORE
-- dong bo them quyen moi neu seed goc da chay truoc do.
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
('super_admin', 'offline_pack.manage'),
('admin',       'offline_pack.manage'),
('poi_manager', 'offline_pack.manage');

-- 14. Release mau v1 cua Zone Quan 1 -----------------------------------------
INSERT IGNORE INTO offline_pack_releases (
    id, zone_id, version,
    common_file_url, common_sha256, common_size_bytes,
    status, created_by, published_by,
    built_at, published_at, created_at
) VALUES (
    '0191a000-0000-7000-8000-000000000101',
    '0191a000-0000-7000-8000-000000000001',
    1,
    '/offline-packs/0191a000-0000-7000-8000-000000000001/v1/common.zip',
    SHA2('seed-placeholder:zone-q1:release-v1:common', 256),
    184320,
    'published',
    '0191a000-0000-7000-9000-000000000002',
    '0191a000-0000-7000-9000-000000000002',
    '2026-11-06 08:00:00.000',
    '2026-11-06 08:05:00.000',
    '2026-11-06 07:55:00.000'
);

-- 15. Language Shards mau (vi & en) -------------------------------------------
INSERT IGNORE INTO offline_pack_languages (
    id, release_id, language_code,
    file_url, sha256, size_bytes,
    status, built_at
)
SELECT
    '0191a000-0000-7000-8000-000000000111',
    '0191a000-0000-7000-8000-000000000101',
    'vi',
    '/offline-packs/0191a000-0000-7000-8000-000000000001/v1/vi.zip',
    SHA2('seed-placeholder:zone-q1:release-v1:language-vi', 256),
    512300,
    'ready',
    '2026-11-06 08:02:00.000'
FROM DUAL
WHERE EXISTS (
    SELECT 1 FROM offline_pack_releases
    WHERE id = '0191a000-0000-7000-8000-000000000101'
)
UNION ALL
SELECT
    '0191a000-0000-7000-8000-000000000112',
    '0191a000-0000-7000-8000-000000000101',
    'en',
    '/offline-packs/0191a000-0000-7000-8000-000000000001/v1/en.zip',
    SHA2('seed-placeholder:zone-q1:release-v1:language-en', 256),
    490100,
    'ready',
    '2026-11-06 08:03:00.000'
FROM DUAL
WHERE EXISTS (
    SELECT 1 FROM offline_pack_releases
    WHERE id = '0191a000-0000-7000-8000-000000000101'
);

-- 16. Kiem tra metadata khoi tao ----------------------------------------------
SELECT r.id, r.zone_id, r.version, r.status,
       r.common_file_url, r.common_sha256, r.common_size_bytes,
       COUNT(l.id) AS ready_language_shards
FROM offline_pack_releases r
LEFT JOIN offline_pack_languages l
       ON l.release_id = r.id AND l.status = 'ready'
WHERE r.id = '0191a000-0000-7000-8000-000000000101'
GROUP BY r.id, r.zone_id, r.version, r.status,
         r.common_file_url, r.common_sha256, r.common_size_bytes;

SELECT rp.role_id, p.id AS permission_id, p.domain
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE p.id = 'offline_pack.manage'
ORDER BY rp.role_id;