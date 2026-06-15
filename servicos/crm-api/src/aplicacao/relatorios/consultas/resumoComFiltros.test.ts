import { describe, expect, it, vi } from 'vitest';
import { consultarKpisResumo, consultarResumoComFiltros } from './resumoComFiltros.js';
import {
  montarCondicoesNegociacao,
  resolverPeriodoFiltro
} from '../utilCondicoesFiltroRelatorio.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';

const filtrosBase: FiltroRelatorio = {
  inicio: '2026-05-01',
  fim: '2026-05-31',
  tipoData: 'criado'
};

describe('resolverPeriodoFiltro / montarCondicoesNegociacao', () => {
  it('resolve período explícito em UTC', () => {
    const periodo = resolverPeriodoFiltro(filtrosBase);
    expect(periodo.inicioInclusiveUtc.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(periodo.fimExclusiveUtc.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('monta condições com leadId', () => {
    const leadId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const db = { select: vi.fn() } as unknown as Parameters<typeof montarCondicoesNegociacao>[0];
    const where = montarCondicoesNegociacao(db, { ...filtrosBase, leadId });
    expect(where).toBeDefined();
  });
});

describe('consultarKpisResumo', () => {
  it('agrega KPIs a partir de linhas mockadas', async () => {
    const negociacoesAgg = [
      { resultado: 'GANHA', total: 2, valorFechado: 100_000, valorEstimado: 0 },
      { resultado: 'ABERTA', total: 3, valorFechado: 0, valorEstimado: 50_000 },
      { resultado: 'PERDIDA', total: 1, valorFechado: 0, valorEstimado: 0 }
    ];
    const contatos = [{ total: 10 }];
    const orcamentos = [{ total: 4 }];

    let call = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      call += 1;
      const fase = ((call - 1) % 3) + 1;
      if (fase === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(contatos)
          })
        };
      }
      if (fase === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(negociacoesAgg)
            })
          })
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(orcamentos)
        })
      };
    });

    const db = { select: selectMock } as unknown as Parameters<typeof consultarKpisResumo>[0];
    const kpis = await consultarKpisResumo(db, filtrosBase);

    expect(kpis.negociacoesGanhas).toBe(2);
    expect(kpis.negociacoesAbertas).toBe(3);
    expect(kpis.negociacoesPerdidas).toBe(1);
    expect(kpis.valorGanhoBrlCentavos).toBe(100_000);
    expect(kpis.pipelineAtivoBrlCentavos).toBe(50_000);
    expect(kpis.ticketMedioBrlCentavos).toBe(50_000);
    expect(kpis.taxaConversaoOrcamentoParaVenda).toBe(50);
    expect(kpis.contatosNoPeriodo).toBe(10);
  });
});

describe('consultarResumoComFiltros integração', () => {
  const url = process.env.DATABASE_URL ?? 'postgres://crm:crm@127.0.0.1:5432/crm';

  it.skipIf(!process.env.CRM_TEST_INTEGRATION)(
    'consulta Postgres com filtro leadId (F1-20)',
    async () => {
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { default: pg } = await import('pg');
      const schema = await import('../../../infra/banco/schema/indiceSchema.js');

      const pool = new pg.Pool({ connectionString: url });
      const db = drizzle(pool, { schema: schema });

      const [lead] = await db
        .select({ id: schema.tabelaLead.id })
        .from(schema.tabelaLead)
        .limit(1);

      if (!lead) {
        await pool.end();
        return;
      }

      const resumo = await consultarResumoComFiltros(db, {
        inicio: '2020-01-01',
        fim: '2030-12-31',
        tipoData: 'criado',
        leadId: lead.id
      });

      expect(resumo.filtrosAplicados.leadId).toBe(lead.id);
      expect(resumo.periodo.inicio).toBeTruthy();
      await pool.end();
    },
    15_000
  );
});
