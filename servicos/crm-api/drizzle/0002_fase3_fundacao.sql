ALTER TABLE "negociacao" ADD COLUMN "motivo_perda" text;
ALTER TABLE "negociacao" ADD COLUMN "responsavel_email" text;

CREATE TABLE IF NOT EXISTS "tag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "negociacao_tag" (
  "negociacao_id" uuid NOT NULL REFERENCES "negociacao"("id") ON DELETE cascade,
  "tag_id" uuid NOT NULL REFERENCES "tag"("id") ON DELETE cascade,
  CONSTRAINT "negociacao_tag_pk" PRIMARY KEY ("negociacao_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "negociacao_responsavel_email_idx" ON "negociacao" ("responsavel_email");
