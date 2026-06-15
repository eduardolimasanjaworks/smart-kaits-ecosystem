// Monta condições Drizzle a partir de FiltroRelatorio.
import { and, eq, exists, gte, inArray, lt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import interpretarPeriodoRelatorio from './interpretarPeriodoRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

function periodoMesAtualStrings() {
  const agora = new Date();
  const inicio = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const fim =
    inicio.slice(0, 8) +
    String(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0)).getUTCDate()).padStart(
      2,
      '0',
    );
  return { inicio, fim };
}

export function resolverPeriodoFiltro(filtros: FiltroRelatorio) {
  const { inicio, fim } =
    filtros.inicio && filtros.fim ? { inicio: filtros.inicio, fim: filtros.fim } : periodoMesAtualStrings();
  const { inicioInclusiveUtc, fimExclusiveUtc } = interpretarPeriodoRelatorio(inicio, fim);
  return {
    inicio,
    fim,
    inicioInclusiveUtc,
    fimExclusiveUtc,
    fimInclusiveIso: new Date(fimExclusiveUtc.getTime() - 1).toISOString(),
    inicioIso: inicioInclusiveUtc.toISOString(),
  };
}

export function montarCondicoesNegociacao(db: Db, filtros: FiltroRelatorio): SQL | undefined {
  const { inicioInclusiveUtc, fimExclusiveUtc } = resolverPeriodoFiltro(filtros);
  const colunaData =
    filtros.tipoData === 'atualizado'
      ? schema.tabelaNegociacao.atualizadoEm
      : schema.tabelaNegociacao.criadoEm;

  const partes: SQL[] = [
    gte(colunaData, inicioInclusiveUtc),
    lt(colunaData, fimExclusiveUtc),
  ];

  if (filtros.responsavelEmail) {
    partes.push(eq(schema.tabelaNegociacao.responsavelEmail, filtros.responsavelEmail.trim().toLowerCase()));
  }
  if (filtros.leadId) partes.push(eq(schema.tabelaNegociacao.leadId, filtros.leadId));
  if (filtros.colunaId) partes.push(eq(schema.tabelaNegociacao.colunaId, filtros.colunaId));
  if (filtros.quadroId) partes.push(eq(schema.tabelaNegociacao.quadroId, filtros.quadroId));
  if (filtros.resultado?.length) {
    partes.push(inArray(schema.tabelaNegociacao.resultado, filtros.resultado));
  }
  if (filtros.produtoId) {
    partes.push(
      exists(
        db
          .select({ id: schema.tabelaNegociacaoProduto.id })
          .from(schema.tabelaNegociacaoProduto)
          .where(
            and(
              eq(schema.tabelaNegociacaoProduto.negociacaoId, schema.tabelaNegociacao.id),
              eq(schema.tabelaNegociacaoProduto.produtoId, filtros.produtoId),
            ),
          ),
      ),
    );
  }

  return partes.length ? and(...partes) : undefined;
}

export function montarCondicoesEventoNoPeriodo(
  db: Db,
  filtros: FiltroRelatorio,
  tipo: 'ORCAMENTO_ENVIADO' | 'CONTATO_REGISTRADO',
): SQL | undefined {
  const { inicioInclusiveUtc, fimExclusiveUtc } = resolverPeriodoFiltro(filtros);
  const partes: SQL[] = [
    eq(schema.tabelaEventoComercial.tipo, tipo),
    gte(schema.tabelaEventoComercial.criadoEm, inicioInclusiveUtc),
    lt(schema.tabelaEventoComercial.criadoEm, fimExclusiveUtc),
  ];

  const condNegEvento: SQL[] = [
    eq(schema.tabelaNegociacao.id, schema.tabelaEventoComercial.negociacaoId),
  ];
  if (filtros.leadId) condNegEvento.push(eq(schema.tabelaNegociacao.leadId, filtros.leadId));
  if (filtros.responsavelEmail) {
    condNegEvento.push(
      eq(schema.tabelaNegociacao.responsavelEmail, filtros.responsavelEmail.trim().toLowerCase()),
    );
  }
  if (filtros.leadId || filtros.responsavelEmail) {
    partes.push(
      exists(
        db.select({ id: schema.tabelaNegociacao.id }).from(schema.tabelaNegociacao).where(and(...condNegEvento)),
      ),
    );
  }

  return and(...partes);
}

export type DbRelatorio = Db;

/** Mesmo período relativo, deslocado um mês para trás (comparativo F2-9). */
export function filtrosMesAnterior(filtros: FiltroRelatorio): FiltroRelatorio {
  const { inicio, fim } = resolverPeriodoFiltro(filtros);
  const [ano, mes] = inicio.split('-').map(Number);
  const mesRef = mes === 1 ? 12 : mes - 1;
  const anoRef = mes === 1 ? ano - 1 : ano;
  const inicioAnt = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(anoRef, mesRef, 0)).getUTCDate();
  const fimAnt = `${anoRef}-${String(mesRef).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { ...filtros, inicio: inicioAnt, fim: fimAnt };
}
