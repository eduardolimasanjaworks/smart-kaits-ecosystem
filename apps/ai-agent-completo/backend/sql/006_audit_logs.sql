-- Logs de auditoria (card "Histórico de Alterações" no front)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(100) NOT NULL,
    detail VARCHAR(255) NOT NULL,
    meta_data JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_school_id ON audit_logs (school_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at DESC);
