-- Sessões de login (opcional). Ative com AUTH_STORE_SESSIONS_IN_DB=true no .env
-- Após aplicar: reinicie a API.

CREATE TABLE IF NOT EXISTS login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    jti VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_login_sessions_jti UNIQUE (jti)
);

CREATE INDEX IF NOT EXISTS ix_login_sessions_school_id ON login_sessions (school_id);
CREATE INDEX IF NOT EXISTS ix_login_sessions_expires_at ON login_sessions (expires_at);
