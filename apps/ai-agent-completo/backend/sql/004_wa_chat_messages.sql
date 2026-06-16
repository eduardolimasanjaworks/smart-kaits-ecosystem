-- Histórico de conversa WhatsApp (Evolution) por escola + número do contacto.
-- Usado como contexto curto para a I.A. (não substitui o RAG de documentos).

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
