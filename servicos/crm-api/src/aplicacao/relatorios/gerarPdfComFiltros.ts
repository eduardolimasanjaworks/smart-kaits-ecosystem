// PDF genérico com filtros de relatório (resumo, faturamento, ranking, amostra da tabela).
import PDFDocument from 'pdfkit';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  FiltroMesesRanking,
  FiltroRelatorio,
} from '../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import { consultarFaturamentoMensal } from './consultas/faturamentoMensal.js';
import { listarNegociacoesRelatorio } from './consultas/listarNegociacoesRelatorio.js';
import { consultarMesesRanking } from './consultas/mesesRanking.js';
import { consultarResumoComFiltros } from './consultas/resumoComFiltros.js';

type Db = NodePgDatabase<typeof schema>;

function centavosParaReal(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function gerarPdfComFiltros(db: Db, filtro: FiltroRelatorio): Promise<Buffer> {
  const filtroRanking: FiltroMesesRanking = { ...filtro, campoMes: 'criado' };
  const [resumo, faturamento, ranking, tabela] = await Promise.all([
    consultarResumoComFiltros(db, filtro),
    consultarFaturamentoMensal(db, filtro),
    consultarMesesRanking(db, filtroRanking),
    listarNegociacoesRelatorio(db, filtro, { limite: 30 }),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Relatório Comercial — Yex', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Filtros: ${JSON.stringify(filtro)}`);
    doc.moveDown();

    doc.fontSize(12).text('Resumo do período', { underline: true });
    doc.text(`Contatos: ${resumo.contatosNoPeriodo} | Ganhas: ${resumo.negociacoesGanhas}`);
    doc.text(`Faturamento (ganhas): ${centavosParaReal(resumo.faturamentoBrutoBrlCentavos)}`);
    doc.text(`Conversão orçamento→venda: ${resumo.taxaConversaoOrcamentoParaVenda}%`);
    doc.moveDown();

    doc.text('Faturamento mensal (ganhas)', { underline: true });
    if (faturamento.serie.length === 0) doc.text('Sem dados no período.');
    else {
      faturamento.serie.forEach((m) => {
        doc.text(
          `• ${m.mes}: ${centavosParaReal(m.valorFechadoBrlCentavos)} (${m.quantidadeGanhas} neg.)`,
        );
      });
    }
    doc.moveDown();

    const { mesComMais, mesComMenos } = ranking.destaque;
    doc.text('Meses (volume)', { underline: true });
    if (mesComMais) doc.text(`Mais negociações: ${mesComMais.mes} (${mesComMais.quantidade})`);
    if (mesComMenos) doc.text(`Menos negociações: ${mesComMenos.mes} (${mesComMenos.quantidade})`);
    doc.moveDown();

    doc.text('Negociações (amostra)', { underline: true });
    if (tabela.itens.length === 0) doc.text('Nenhum registro.');
    else {
      tabela.itens.forEach((n) => {
        doc.text(
          `• ${n.titulo} — ${n.cliente} — ${n.coluna} — ${n.resultado} — ${centavosParaReal(n.valorFechadoBrlCentavos)}`,
        );
      });
    }

    doc.end();
  });
}
