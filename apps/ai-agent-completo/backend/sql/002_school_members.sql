-- Membros da equipe Smart Kaits por escola (login próprio: slug + e-mail + senha).
-- Rode após as tabelas base de schools.

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
