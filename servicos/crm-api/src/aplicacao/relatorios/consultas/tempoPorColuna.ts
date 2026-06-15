// Média e mediana de dias por coluna a partir de historico_coluna.
import { sql } from 'drizzle-orm';
import type { DbRelatorios } from '../tiposDb.js';

export type LinhaTempoColuna = {
  colunaId: string;
  titulo: string;
  ordemPosicao: number;
  mediaDias: number;
  medianaDias: number;
  amostras: number;
};

type FiltrosTempoColuna = {
  quadroId?: string;
  inicioUtc?: Date;
  fimExclusiveUtc?: Date;
};

export async function consultarTempoPorColuna(
  db: DbRelatorios,
  filtros: FiltrosTempoColuna = {},
): Promise<LinhaTempoColuna[]> {
  const filtroQuadro = filtros.quadroId
    ? sql`AND n.quadro_id = ${filtros.quadroId}::uuid`
    : sql``;
  const filtroPeriodo =
    filtros.inicioUtc && filtros.fimExclusiveUtc
      ? sql`AND m.entrada_em >= ${filtros.inicioUtc} AND m.entrada_em < ${filtros.fimExclusiveUtc}`
      : sql``;

  const resultado = await db.execute(sql`
    WITH movimentos AS (
      SELECT
        h.negociacao_id,
        h.coluna_destino_id AS coluna_id,
        h.criado_em AS entrada_em,
        LEAD(h.criado_em) OVER (
          PARTITION BY h.negociacao_id ORDER BY h.criado_em
        ) AS saida_em
      FROM historico_coluna h
      INNER JOIN negociacao n ON n.id = h.negociacao_id
      WHERE h.coluna_destino_id IS NOT NULL
      ${filtroQuadro}
    ),
    permanencias AS (
      SELECT
        m.coluna_id,
        EXTRACT(EPOCH FROM (COALESCE(m.saida_em, NOW()) - m.entrada_em)) / 86400.0 AS dias
      FROM movimentos m
      WHERE 1 = 1
      ${filtroPeriodo}
    )
    SELECT
      c.id AS coluna_id,
      c.titulo,
      c.ordem_posicao,
      ROUND(AVG(p.dias)::numeric, 2) AS media_dias,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.dias))::numeric, 2) AS mediana_dias,
      COUNT(*)::int AS amostras
    FROM permanencias p
    INNER JOIN coluna c ON c.id = p.coluna_id
    GROUP BY c.id, c.titulo, c.ordem_posicao
    ORDER BY c.ordem_posicao
  `);

  const linhas = resultado.rows as Array<Record<string, unknown>>;
  return linhas.map((r) => ({
    colunaId: String(r.coluna_id),
    titulo: String(r.titulo),
    ordemPosicao: Number(r.ordem_posicao),
    mediaDias: Number(r.media_dias),
    medianaDias: Number(r.mediana_dias),
    amostras: Number(r.amostras),
  }));
}
