// Conversão entre colunas adjacentes (primeira passagem por negociação).
import { asc, eq, sql } from 'drizzle-orm';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { DbRelatorios } from '../tiposDb.js';

export type EtapaConversaoFunil = {
  colunaOrigemId: string;
  colunaOrigemTitulo: string;
  colunaDestinoId: string;
  colunaDestinoTitulo: string;
  ordemOrigem: number;
  totalPrimeiraPassagemOrigem: number;
  totalPrimeiraPassagemDestino: number;
  taxaConversaoPercentual: number;
};

export async function consultarConversaoFunil(
  db: DbRelatorios,
  quadroId: string,
): Promise<EtapaConversaoFunil[]> {
  const colunas = await db
    .select({
      id: schema.tabelaColuna.id,
      titulo: schema.tabelaColuna.titulo,
      ordemPosicao: schema.tabelaColuna.ordemPosicao,
    })
    .from(schema.tabelaColuna)
    .where(eq(schema.tabelaColuna.quadroId, quadroId))
    .orderBy(asc(schema.tabelaColuna.ordemPosicao));

  if (colunas.length < 2) return [];

  const primeiraEntrada = await db.execute(sql`
    SELECT DISTINCT ON (h.negociacao_id, h.coluna_destino_id)
      h.negociacao_id,
      h.coluna_destino_id,
      h.criado_em
    FROM historico_coluna h
    INNER JOIN negociacao n ON n.id = h.negociacao_id
    WHERE n.quadro_id = ${quadroId}::uuid
    ORDER BY h.negociacao_id, h.coluna_destino_id, h.criado_em ASC
  `);

  const porNegociacao = new Map<string, Map<string, Date>>();
  for (const linha of primeiraEntrada.rows as Array<Record<string, unknown>>) {
    const negId = String(linha.negociacao_id);
    const colId = String(linha.coluna_destino_id);
    const quando = new Date(String(linha.criado_em));
    if (!porNegociacao.has(negId)) porNegociacao.set(negId, new Map());
    porNegociacao.get(negId)!.set(colId, quando);
  }

  const etapas: EtapaConversaoFunil[] = [];
  for (let i = 0; i < colunas.length - 1; i += 1) {
    const origem = colunas[i];
    const destino = colunas[i + 1];
    let totalOrigem = 0;
    let totalDestino = 0;

    for (const visitas of porNegociacao.values()) {
      const tOrigem = visitas.get(origem.id);
      if (!tOrigem) continue;
      totalOrigem += 1;
      const tDestino = visitas.get(destino.id);
      if (tDestino && tDestino >= tOrigem) totalDestino += 1;
    }

    const taxa =
      totalOrigem > 0 ? Math.round((totalDestino / totalOrigem) * 100) : 0;
    etapas.push({
      colunaOrigemId: origem.id,
      colunaOrigemTitulo: origem.titulo,
      colunaDestinoId: destino.id,
      colunaDestinoTitulo: destino.titulo,
      ordemOrigem: origem.ordemPosicao,
      totalPrimeiraPassagemOrigem: totalOrigem,
      totalPrimeiraPassagemDestino: totalDestino,
      taxaConversaoPercentual: taxa,
    });
  }

  return etapas;
}
