-- Escolas para o portal mock (Login1 / Login2 + senha123).
-- Rode antes: 005_schools_evolution_columns_if_missing.sql e 004_wa_chat_messages.sql (opcional WA).
-- bcrypt para senha literal "senha123" (gerado com bcrypt, custo 12)

BEGIN;

INSERT INTO schools (id, name, slug, password_hash, is_active)
VALUES
  ('a1111111-1111-4111-8111-111111110001'::uuid, 'Escola Mock Login 1', 'login1',
   '$2b$12$St5BMC3bpYgEiZoMUKxlZO3kBzYF8S2j602xw90cQSk7kBl70BCny', true),
  ('a1111111-1111-4111-8111-111111110002'::uuid, 'Escola Mock Login 2', 'login2',
   '$2b$12$St5BMC3bpYgEiZoMUKxlZO3kBzYF8S2j602xw90cQSk7kBl70BCny', true)
ON CONFLICT (slug) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name;

INSERT INTO agent_configs (id, school_id, data)
VALUES
  ('b1111111-1111-4111-8111-111111110001'::uuid, 'a1111111-1111-4111-8111-111111110001'::uuid,
   '{"assistantName":"Assistente","personality":"Objetiva.","greeting":"Olá!","isPaused":false,"scriptRules":[],"teamMembers":[],"faqItems":[],"docs":[],"fallbackContact":"","fallbackMessage":"","fallbackUserMessage":"","apiToken":"","tools":{"consultClasses":false,"checkSchedule":false,"enrollStudent":false,"checkFinancial":false}}'::jsonb),
  ('b1111111-1111-4111-8111-111111110002'::uuid, 'a1111111-1111-4111-8111-111111110002'::uuid,
   '{"assistantName":"Assistente","personality":"Objetiva.","greeting":"Olá!","isPaused":false,"scriptRules":[],"teamMembers":[],"faqItems":[],"docs":[],"fallbackContact":"","fallbackMessage":"","fallbackUserMessage":"","apiToken":"","tools":{"consultClasses":false,"checkSchedule":false,"enrollStudent":false,"checkFinancial":false}}'::jsonb)
ON CONFLICT (school_id) DO NOTHING;

COMMIT;
