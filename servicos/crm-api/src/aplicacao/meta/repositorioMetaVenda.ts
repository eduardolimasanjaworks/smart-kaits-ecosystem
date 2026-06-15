// Metas de vendas com progresso vs faturamento ganho no período.
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';

type Db = NodePgDatabase<typeof schema>;

export type MetaVendaDto = {
  id: string;
  periodo: 'SEMANAL' | 'MENSAL';
  inicioPeriodo: string;
  valorAlvoBrlCentavos: number;
  valorAtingidoBrlCentavos: number;
  percentualAtingido: number;
  criadoEm: string;
};

function fimExclusiveUtc(inicioPeriodo: string, periodo: 'SEMANAL' | 'MENSAL'): Date {
  const [ano, mes, dia] = inicioPeriodo.split('-').map(Number);
  if (periodo === 'SEMANAL') {
    return new Date(Date.UTC(ano, mes - 1, dia + 7));
  }
  return new Date(Date.UTC(ano, mes, dia));
}

async function somarGanhoNoPeriodo(db: Db, inicio: Date, fim: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}), 0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(
      and(
        eq(schema.tabelaNegociacao.resultado, 'GANHA'),
        gte(schema.tabelaNegociacao.atualizadoEm, inicio),
        lt(schema.tabelaNegociacao.atualizadoEm, fim),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function listarMetasComProgresso(db: Db): Promise<MetaVendaDto[]> {
  const metas = await db.select().from(schema.tabelaMetaVenda).limit(100);
  const resultado: MetaVendaDto[] = [];
  for (const meta of metas) {
    const inicio = new Date(`${meta.inicioPeriodo}T00:00:00.000Z`);
    const fim = fimExclusiveUtc(String(meta.inicioPeriodo), meta.periodo);
    const atingido = await somarGanhoNoPeriodo(db, inicio, fim);
    const alvo = meta.valorAlvoBrlCentavos;
    resultado.push({
      id: meta.id,
      periodo: meta.periodo,
      inicioPeriodo: String(meta.inicioPeriodo),
      valorAlvoBrlCentavos: alvo,
      valorAtingidoBrlCentavos: atingido,
      percentualAtingido: alvo > 0 ? Math.round((atingido / alvo) * 1000) / 10 : 0,
      criadoEm: meta.criadoEm.toISOString(),
    });
  }
  return resultado.sort((a, b) => b.inicioPeriodo.localeCompare(a.inicioPeriodo));
}

export async function criarMeta(
  db: Db,
  dados: { periodo: 'SEMANAL' | 'MENSAL'; inicioPeriodo: string; valorAlvoBrlCentavos: number },
): Promise<MetaVendaDto> {
  const [meta] = await db.insert(schema.tabelaMetaVenda).values(dados).returning();
  const inicio = new Date(`${meta.inicioPeriodo}T00:00:00.000Z`);
  const fim = fimExclusiveUtc(String(meta.inicioPeriodo), meta.periodo);
  const atingido = await somarGanhoNoPeriodo(db, inicio, fim);
  const alvo = meta.valorAlvoBrlCentavos;
  return {
    id: meta.id,
    periodo: meta.periodo,
    inicioPeriodo: String(meta.inicioPeriodo),
    valorAlvoBrlCentavos: alvo,
    valorAtingidoBrlCentavos: atingido,
    percentualAtingido: alvo > 0 ? Math.round((atingido / alvo) * 1000) / 10 : 0,
    criadoEm: meta.criadoEm.toISOString(),
  };
}
