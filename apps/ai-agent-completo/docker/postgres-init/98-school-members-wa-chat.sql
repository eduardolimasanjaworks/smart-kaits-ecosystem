-- Tabelas usadas pelo Smart Kaits que não vêm do Alembic inicial antigo.
-- Membros da equipe (login slug + email).
CREATE TABLE IF NOT EXISTS school_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_members_school_email UNIQUE (school_id, email)
);
CREATE INDEX IF NOT EXISTS ix_school_members_school_id ON school_members (school_id);

-- Histórico curto WhatsApp → contexto da I.A.
CREATE TABLE IF NOT EXISTS wa_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    contact_e164 VARCHAR(32) NOT NULL,
    role VARCHAR(16) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_wa_chat_role CHECK (role IN ('user', 'assistant'))
);
CREATE INDEX IF NOT EXISTS ix_wa_chat_school_contact_time
    ON wa_chat_messages (school_id, contact_e164, created_at DESC);
