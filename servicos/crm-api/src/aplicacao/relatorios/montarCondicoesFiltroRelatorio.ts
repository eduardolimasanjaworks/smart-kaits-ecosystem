// Condições SQL Drizzle a partir do filtro de relatório (produto via join na consulta).
import { and, eq, gte, inArray, lt, type SQL } from 'drizzle-orm';
import type { FiltroRelatorio } from '../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import interpretarPeriodoRelatorio from './interpretarPeriodoRelatorio.js';

export function montarCondicoesFiltroRelatorio(filtro: FiltroRelatorio): SQL | undefined {
  const partes: SQL[] = [];

  if (filtro.inicio && filtro.fim) {
    const { inicioInclusiveUtc, fimExclusiveUtc } = interpretarPeriodoRelatorio(
      filtro.inicio,
      filtro.fim,
    );
    const campoData =
      filtro.tipoData === 'atualizado'
        ? schema.tabelaNegociacao.atualizadoEm
        : schema.tabelaNegociacao.criadoEm;
    partes.push(gte(campoData, inicioInclusiveUtc), lt(campoData, fimExclusiveUtc));
  }

  if (filtro.responsavelEmail) {
    partes.push(
      eq(schema.tabelaNegociacao.responsavelEmail, filtro.responsavelEmail.trim().toLowerCase()),
    );
  }
  if (filtro.leadId) partes.push(eq(schema.tabelaNegociacao.leadId, filtro.leadId));
  if (filtro.colunaId) partes.push(eq(schema.tabelaNegociacao.colunaId, filtro.colunaId));
  if (filtro.quadroId) partes.push(eq(schema.tabelaNegociacao.quadroId, filtro.quadroId));

  const resultados = filtro.resultado
    ? Array.isArray(filtro.resultado)
      ? filtro.resultado
      : [filtro.resultado]
    : null;
  if (resultados?.length) partes.push(inArray(schema.tabelaNegociacao.resultado, resultados));

  if (partes.length === 0) return undefined;
  return and(...partes);
}

export function condicaoJoinProduto(filtro: FiltroRelatorio) {
  if (!filtro.produtoId) return undefined;
  return and(
    eq(schema.tabelaNegociacaoProduto.negociacaoId, schema.tabelaNegociacao.id),
    eq(schema.tabelaNegociacaoProduto.produtoId, filtro.produtoId),
  );
}
