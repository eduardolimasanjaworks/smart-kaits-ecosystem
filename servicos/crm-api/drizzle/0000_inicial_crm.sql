CREATE TYPE "public"."resultado_negociacao" AS ENUM('ABERTA', 'GANHA', 'PERDIDA', 'ARQUIVADA');
CREATE TYPE "public"."tipo_evento_comercial" AS ENUM('ORCAMENTO_ENVIADO', 'CONTATO_REGISTRADO');
CREATE TYPE "public"."periodo_meta" AS ENUM('SEMANAL', 'MENSAL');

CREATE TABLE IF NOT EXISTS "lead" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome_contato" text NOT NULL,
  "email_contato" text,
  "telefone_contato" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quadro" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "titulo" text NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coluna" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quadro_id" uuid NOT NULL REFERENCES "quadro"("id") ON DELETE cascade,
  "titulo" text NOT NULL,
  "ordem_posicao" integer DEFAULT 0 NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "produto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "codigo_sku" text,
  "preco_referencia_brl_centavos" bigint DEFAULT 0 NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "negociacao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "lead"("id"),
  "quadro_id" uuid NOT NULL REFERENCES "quadro"("id"),
  "coluna_id" uuid NOT NULL REFERENCES "coluna"("id"),
  "titulo" text NOT NULL,
  "descricao" text,
  "valor_estimado_brl_centavos" bigint DEFAULT 0 NOT NULL,
  "valor_fechado_brl_centavos" bigint DEFAULT 0 NOT NULL,
  "resultado" "resultado_negociacao" DEFAULT 'ABERTA' NOT NULL,
  "planka_card_id" uuid,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "negociacao_produto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "negociacao_id" uuid NOT NULL REFERENCES "negociacao"("id") ON DELETE cascade,
  "produto_id" uuid NOT NULL REFERENCES "produto"("id"),
  "quantidade" integer NOT NULL,
  "preco_unitario_brl_centavos" bigint NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "historico_coluna" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "negociacao_id" uuid NOT NULL REFERENCES "negociacao"("id") ON DELETE cascade,
  "coluna_origem_id" uuid REFERENCES "coluna"("id"),
  "coluna_destino_id" uuid NOT NULL REFERENCES "coluna"("id"),
  "rastreamento_id" text NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "evento_comercial" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "negociacao_id" uuid NOT NULL REFERENCES "negociacao"("id") ON DELETE cascade,
  "tipo" "tipo_evento_comercial" NOT NULL,
  "metadados" jsonb,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "meta_venda" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "periodo" "periodo_meta" NOT NULL,
  "inicio_periodo" date NOT NULL,
  "valor_alvo_brl_centavos" bigint NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "papel" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "codigo" text NOT NULL,
  "titulo" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "usuario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "nome" text NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "usuario_papel" (
  "usuario_id" uuid NOT NULL REFERENCES "usuario"("id"),
  "papel_id" uuid NOT NULL REFERENCES "papel"("id")
);
