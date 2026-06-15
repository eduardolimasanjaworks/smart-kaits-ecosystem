// Geração de payload de KPIs para desenvolvimento: mantém a UI desacoplada do Directus.
import type { KpisConsolidado, PontoSerieFaturamento } from "@/dominio/contratos/tiposKpi";
import calcularProporcaoAlimentosBoliche from "@/lib/calculos/proporcaoAlimentosBoliche";

function gerarSerie(quantidadeDias: number, multiplicador: number): PontoSerieFaturamento[] {
  const serie: PontoSerieFaturamento[] = [];
  for (let indice = 0; indice < quantidadeDias; indice += 1) {
    const dia = `Dia ${indice + 1}`;
    const ondulacao = 1 + 0.08 * Math.sin(indice / 2);
    serie.push({ dia, valor: Math.round((8000 + indice * 120) * multiplicador * ondulacao) });
  }
  return serie;
}

/**
 * Monta KPIs fictícios porém coerentes com as regras de cálculo do domínio.
 */
export default function obterDadosMockKpis(): KpisConsolidado {
  const faturamentoBoliche = 42000;
  const faturamentoAlimentosBebidas = 38000;
  const proporcaoAlimentosPorRealBoliche = calcularProporcaoAlimentosBoliche({
    faturamentoAlimentosBebidas,
    faturamentoBoliche,
  });

  return {
    faturamentoGlobal: {
      valorAtual: 428_000,
      valorAnoAnterior: 401_000,
      serieDiariaAtual: gerarSerie(18, 1),
      serieDiariaAnterior: gerarSerie(18, 0.92),
    },
    restaurante: {
      faturamentoSegundaQuinta: 118_000,
      faturamentoSextaDomingo: 152_000,
      ticketMedioSegundaQuinta: 86,
      ticketMedioSextaDomingo: 112,
      quantidadeSegundaQuinta: 1372,
      quantidadeSextaDomingo: 1358,
    },
    boliche: {
      faturamentoPorPista: faturamentoBoliche,
      ticketMedioPartida: 34,
      faturamentoAlimentosBebidas,
      proporcaoAlimentosPorRealBoliche,
      rankingBebidas: [
        { nome: "Chopp Pilsen", valorReais: 9200, unidades: 640 },
        { nome: "Refrigerante Lata", valorReais: 5400, unidades: 980 },
        { nome: "Água com gás", valorReais: 2100, unidades: 700 },
        { nome: "Caipirinha", valorReais: 4800, unidades: 220 },
        { nome: "Suco natural", valorReais: 2600, unidades: 310 },
      ],
      rankingComidas: [
        { nome: "Burger house", valorReais: 8800, unidades: 420 },
        { nome: "Porção de fritas", valorReais: 4100, unidades: 910 },
        { nome: "Pizza broto", valorReais: 6200, unidades: 280 },
        { nome: "Nachos", valorReais: 3300, unidades: 260 },
        { nome: "Brownie", valorReais: 1900, unidades: 210 },
      ],
    },
    eventos: {
      faturamento: 74_000,
      quantidadeVendidos: 18,
      ticketMedioEvento: 4111,
      ticketMedioPessoa: 168,
      funilApresentacoesFeitas: 42,
      funilLeadsMes: 128,
      funilLeadsTotais: 540,
    },
    whatsapp: {
      intencoes: [
        { rotulo: "preço pista boliche", peso: 34 },
        { rotulo: "evento aniversário", peso: 22 },
        { rotulo: "cardápio restaurante", peso: 18 },
        { rotulo: "horário funcionamento", peso: 14 },
      ],
    },
  };
}
