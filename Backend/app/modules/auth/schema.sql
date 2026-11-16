CREATE TABLE IF NOT EXISTS auth_account_security (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(3) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_session_assurance (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    credential_hash CHAR(64) NOT NULL,
    mfa_verified BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_challenges (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    kind VARCHAR(10) NOT NULL,
    proof_hash CHAR(64) NULL,
    credential_hash CHAR(64) NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_auth_challenge_user_kind (user_id, kind),
    KEY idx_auth_challenge_expiry (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (kind IN ('mfa', 'reset'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
