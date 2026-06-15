// Consultas e comandos de negociação no Postgres (sem SELECT *).
import { desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import { tituloColunaEhOrcamentoEnviado } from '../../constantes/titulosColunaFunil.js';

type Db = NodePgDatabase<typeof schema>;

export async function inserirNegociacao(
  db: Db,
  dados: {
    leadId: string;
    quadroId: string;
    colunaId: string;
    titulo: string;
    descricao?: string | null;
    valorEstimadoBrlCentavos: number;
    valorFechadoBrlCentavos: number;
    resultado: 'ABERTA' | 'GANHA' | 'PERDIDA' | 'ARQUIVADA';
    mesPrevistoEvento?: string | null;
    motivoPerda?: string | null;
    responsavelEmail?: string | null;
    plankaCardId?: string | null;
  },
) {
  const [criada] = await db
    .insert(schema.tabelaNegociacao)
    .values(dados)
    .returning({
      id: schema.tabelaNegociacao.id,
      titulo: schema.tabelaNegociacao.titulo,
      descricao: schema.tabelaNegociacao.descricao,
      colunaId: schema.tabelaNegociacao.colunaId,
      valorEstimadoBrlCentavos: schema.tabelaNegociacao.valorEstimadoBrlCentavos,
      resultado: schema.tabelaNegociacao.resultado,
      criadoEm: schema.tabelaNegociacao.criadoEm,
    });

  await db.insert(schema.tabelaHistoricoColuna).values({
    negociacaoId: criada.id,
    colunaOrigemId: null,
    colunaDestinoId: dados.colunaId,
    rastreamentoId: crypto.randomUUID(),
  });

  return criada;
}

export async function listarKanbanPorQuadro(db: Db, quadroId: string) {
  const colunas = await db
    .select({
      id: schema.tabelaColuna.id,
      titulo: schema.tabelaColuna.titulo,
      ordemPosicao: schema.tabelaColuna.ordemPosicao,
    })
    .from(schema.tabelaColuna)
    .where(eq(schema.tabelaColuna.quadroId, quadroId))
    .orderBy(schema.tabelaColuna.ordemPosicao);

  const negociacoes = await db
    .select({
      id: schema.tabelaNegociacao.id,
      titulo: schema.tabelaNegociacao.titulo,
      descricao: schema.tabelaNegociacao.descricao,
      colunaId: schema.tabelaNegociacao.colunaId,
      valorEstimadoBrlCentavos: schema.tabelaNegociacao.valorEstimadoBrlCentavos,
      valorFechadoBrlCentavos: schema.tabelaNegociacao.valorFechadoBrlCentavos,
      resultado: schema.tabelaNegociacao.resultado,
      leadNome: schema.tabelaLead.nomeContato,
      criadoEm: schema.tabelaNegociacao.criadoEm,
    })
    .from(schema.tabelaNegociacao)
    .innerJoin(schema.tabelaLead, eq(schema.tabelaLead.id, schema.tabelaNegociacao.leadId))
    .where(eq(schema.tabelaNegociacao.quadroId, quadroId))
    .orderBy(desc(schema.tabelaNegociacao.criadoEm));

  return { colunas, negociacoes };
}

export async function moverNegociacao(
  db: Db,
  negociacaoId: string,
  colunaDestinoId: string,
  rastreamentoId: string,
) {
  const [atual] = await db
    .select({ colunaId: schema.tabelaNegociacao.colunaId })
    .from(schema.tabelaNegociacao)
    .where(eq(schema.tabelaNegociacao.id, negociacaoId))
    .limit(1);

  if (!atual) return null;

  await db
    .update(schema.tabelaNegociacao)
    .set({ colunaId: colunaDestinoId, atualizadoEm: sql`now()` })
    .where(eq(schema.tabelaNegociacao.id, negociacaoId));

  await db.insert(schema.tabelaHistoricoColuna).values({
    negociacaoId,
    colunaOrigemId: atual.colunaId,
    colunaDestinoId,
    rastreamentoId,
  });

  const [colunaDestino] = await db
    .select({ titulo: schema.tabelaColuna.titulo })
    .from(schema.tabelaColuna)
    .where(eq(schema.tabelaColuna.id, colunaDestinoId))
    .limit(1);

  if (colunaDestino && tituloColunaEhOrcamentoEnviado(colunaDestino.titulo)) {
    await db.insert(schema.tabelaEventoComercial).values({
      negociacaoId,
      tipo: 'ORCAMENTO_ENVIADO',
      metadados: { origem: 'mover_negociacao', rastreamentoId },
    });
  }

  return { ok: true };
}
