// Cards separados para o boliche
import type { BlocoBoliche } from "@/dominio/contratos/tiposKpi";
import { PROPORCAO_META_BOLICHE_ALIMENTOS } from "@/constantes/paleta";
import CartaoVidro from "@/modulos/compartilhado/CartaoVidro";
import ListaRankingExpansivel from "@/modulos/boliche/ListaRankingExpansivel";

type PropriedadesCartaoBoliche = {
  bloco: BlocoBoliche;
};

export function CartaoBolicheIndicadores({ bloco }: PropriedadesCartaoBoliche) {
  return (
    <CartaoVidro titulo="Boliche - Indicadores">
      <div className="flex h-full flex-col justify-center">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricaDetalhada
            titulo="Faturamento por Pista"
            valor={formatarMoeda(bloco.faturamentoPorPista)}
            descricao="Média gerada por cada pista ativa"
          />
          <MetricaDetalhada
            titulo="Ticket Médio da Partida"
            valor={formatarMoeda(bloco.ticketMedioPartida)}
            descricao="Valor médio gasto apenas em boliche"
          />
        </div>
      </div>
    </CartaoVidro>
  );
}

export function CartaoBolicheConsumoCruzado({ bloco }: PropriedadesCartaoBoliche) {
  const abaixoDaMeta = bloco.proporcaoAlimentosPorRealBoliche < PROPORCAO_META_BOLICHE_ALIMENTOS;
  return (
    <CartaoVidro titulo="Boliche - Consumo Cruzado" variante={abaixoDaMeta ? "alerta" : "padrao"}>
      <div className="flex h-full flex-col justify-center">
        <div className="rounded-xl border border-borda-sutil bg-fundo-container shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-fundo-profundo p-4">
            <div className="mb-4 sm:mb-0">
              <div className="mb-1.5 inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-acento-marca/10 text-xs text-acento-marca">
                  🍕
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-texto-secundario">
                  Consumo Cruzado
                </p>
              </div>
              <p className="text-sm font-medium text-texto-principal">
                Alimentos e Bebidas (A&B) por R$1 nas pistas
              </p>
            </div>
            <div className="flex shrink-0 items-center rounded-lg bg-white px-4 py-2 border border-borda-sutil shadow-sm">
              <div className="text-center sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-texto-secundario">
                  Meta: {PROPORCAO_META_BOLICHE_ALIMENTOS}:1
                </p>
                <p
                  className={
                    abaixoDaMeta
                      ? "mt-0.5 text-2xl font-black tracking-tight text-acento-alerta"
                      : "mt-0.5 text-2xl font-black tracking-tight text-acento-sucesso"
                  }
                >
                  {bloco.proporcaoAlimentosPorRealBoliche.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CartaoVidro>
  );
}

export function CartaoBolicheRanking({ bloco }: PropriedadesCartaoBoliche) {
  return (
    <CartaoVidro titulo="Boliche - Ranking de Consumo">
      <div className="flex h-full flex-col justify-center">
        <div className="grid gap-6 md:grid-cols-2 rounded-xl border border-borda-sutil bg-fundo-container p-4">
          <ListaRankingExpansivel titulo="Top Bebidas" itens={bloco.rankingBebidas} />
          <ListaRankingExpansivel titulo="Top Comidas" itens={bloco.rankingComidas} />
        </div>
      </div>
    </CartaoVidro>
  );
}

type PropriedadesMetricaDetalhada = {
  titulo: string;
  valor: string;
  descricao: string;
};

function MetricaDetalhada({ titulo, valor, descricao }: PropriedadesMetricaDetalhada) {
  return (
    <div className="rounded-lg border border-borda-sutil bg-fundo-container p-3 shadow-sm h-full">
      <p className="text-xs font-semibold text-texto-principal">{titulo}</p>
      <p className="mt-1 text-lg font-bold text-texto-principal">{valor}</p>
      <p className="mt-1 text-[10px] text-texto-secundario">{descricao}</p>
    </div>
  );
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
