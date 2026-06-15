// Schema Zod espelhando KpisConsolidado: valida respostas da API antes de tocar na UI.
import { z } from "zod";

const esquemaPontoSerie = z.object({
  dia: z.string(),
  valor: z.number(),
});

const esquemaItemRanking = z.object({
  nome: z.string(),
  valorReais: z.number(),
  unidades: z.number(),
});

export const esquemaKpisConsolidado = z.object({
  faturamentoGlobal: z.object({
    valorAtual: z.number(),
    valorAnoAnterior: z.number(),
    serieDiariaAtual: z.array(esquemaPontoSerie),
    serieDiariaAnterior: z.array(esquemaPontoSerie),
  }),
  restaurante: z.object({
    faturamentoSegundaQuinta: z.number(),
    faturamentoSextaDomingo: z.number(),
    ticketMedioSegundaQuinta: z.number(),
    ticketMedioSextaDomingo: z.number(),
    quantidadeSegundaQuinta: z.number(),
    quantidadeSextaDomingo: z.number(),
  }),
  boliche: z.object({
    faturamentoPorPista: z.number(),
    ticketMedioPartida: z.number(),
    faturamentoAlimentosBebidas: z.number(),
    proporcaoAlimentosPorRealBoliche: z.number(),
    rankingBebidas: z.array(esquemaItemRanking),
    rankingComidas: z.array(esquemaItemRanking),
  }),
  eventos: z.object({
    faturamento: z.number(),
    quantidadeVendidos: z.number(),
    ticketMedioEvento: z.number(),
    ticketMedioPessoa: z.number(),
    funilApresentacoesFeitas: z.number(),
    funilLeadsMes: z.number(),
    funilLeadsTotais: z.number(),
  }),
  whatsapp: z.object({
    intencoes: z.array(
      z.object({
        rotulo: z.string(),
        peso: z.number(),
      }),
    ),
  }),
});
