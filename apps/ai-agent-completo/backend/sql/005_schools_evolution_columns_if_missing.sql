-- Compatibilidade: bases antigas sem colunas Evolution
ALTER TABLE schools ADD COLUMN IF NOT EXISTS evolution_instance_name VARCHAR(80);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS evolution_instance_token VARCHAR(512);
