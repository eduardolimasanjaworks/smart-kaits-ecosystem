CREATE TABLE IF NOT EXISTS "cupom" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "codigo" text NOT NULL,
  "nome" text NOT NULL,
  "motivo" text NOT NULL,
  "desconto_percentual" integer NOT NULL,
  "validade" date NOT NULL,
  "queimado_em" timestamp with time zone,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cupom_token_idx" ON "cupom" ("token");
