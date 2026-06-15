// Gera PDF de insights comerciais por cliente/lead (buffer).
import PDFDocument from 'pdfkit';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import { montarResumoComercial } from './montarResumoComercial.js';

type Db = NodePgDatabase<typeof schema>;

function centavosParaReal(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function gerarPdfCliente(db: Db, leadId: string): Promise<Buffer> {
  const [lead] = await db
    .select({
      nome: schema.tabelaLead.nomeContato,
      email: schema.tabelaLead.emailContato,
      telefone: schema.tabelaLead.telefoneContato,
    })
    .from(schema.tabelaLead)
    .where(eq(schema.tabelaLead.id, leadId))
    .limit(1);

  if (!lead) throw new Error('Lead não encontrado');

  const negociacoes = await db
    .select({
      titulo: schema.tabelaNegociacao.titulo,
      resultado: schema.tabelaNegociacao.resultado,
      valorEstimado: schema.tabelaNegociacao.valorEstimadoBrlCentavos,
      valorFechado: schema.tabelaNegociacao.valorFechadoBrlCentavos,
      criadoEm: schema.tabelaNegociacao.criadoEm,
    })
    .from(schema.tabelaNegociacao)
    .where(eq(schema.tabelaNegociacao.leadId, leadId));

  const resumo = await montarResumoComercial(db);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Relatório Comercial — Yex', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Cliente: ${lead.nome}`);
    if (lead.email) doc.text(`E-mail: ${lead.email}`);
    if (lead.telefone) doc.text(`Telefone: ${lead.telefone}`);
    doc.moveDown();

    doc.fontSize(12).text('Resumo do mês (empresa)', { underline: true });
    doc.text(`Contatos novos: ${resumo.contatosNoMes}`);
    doc.text(`Orçamentos enviados: ${resumo.orcamentosEnviados}`);
    doc.text(`Taxa orçamento → venda: ${resumo.taxaConversaoOrcamentoParaVenda}%`);
    doc.text(`Faturamento bruto (ganhas): ${centavosParaReal(resumo.faturamentoBrutoBrlCentavos)}`);
    doc.moveDown();

    doc.text('Negociações deste cliente', { underline: true });
    if (negociacoes.length === 0) {
      doc.text('Nenhuma negociação registrada.');
    } else {
      negociacoes.forEach((n) => {
        doc.text(
          `• ${n.titulo} — ${n.resultado} — estimado ${centavosParaReal(n.valorEstimado)} — fechado ${centavosParaReal(n.valorFechado)}`,
        );
      });
    }

    doc.moveDown();
    doc.text('Insights para o dono do negócio', { underline: true });
    doc.text('• Priorize follow-up em negociações abertas com orçamento já enviado.');
    doc.text('• Compare tempo em cada etapa do funil para reduzir gargalos.');
    doc.text('• Produtos mais vendidos no período guiam campanhas e metas da equipe.');

    doc.end();
  });
}
