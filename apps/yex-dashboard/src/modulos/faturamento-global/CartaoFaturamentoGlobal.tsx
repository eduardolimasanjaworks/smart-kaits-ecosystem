// Card-mestre de faturamento global: YoY, brush e split-view conforme plano de UX.
import type { BlocoFaturamentoGlobal } from "@/dominio/contratos/tiposKpi";
import CartaoVidro from "@/modulos/compartilhado/CartaoVidro";
import GraficoBrushFaturamento from "@/modulos/faturamento-global/GraficoBrushFaturamento";
import calcularVariacaoPercentual from "@/lib/calculos/variacaoPercentual";

type PropriedadesCartaoFaturamentoGlobal = {
  bloco: BlocoFaturamentoGlobal;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function CartaoFaturamentoGlobal({ bloco }: PropriedadesCartaoFaturamentoGlobal) {
  const variacao = calcularVariacaoPercentual({
    valorAtual: bloco.valorAtual,
    valorAnterior: bloco.valorAnoAnterior,
  });
  const temQueda = variacao < 0;
  return (
    <CartaoVidro
      titulo="Faturamento global (vs ano anterior)"
      variante={temQueda ? "alerta" : "destaque"}
    >
      <div className="space-y-5">
        {/* KPIs em linha */}
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs font-medium text-texto-secundario">Acumulado</p>
            <p className="text-3xl font-bold tracking-tight text-texto-principal">
              {formatarMoeda(bloco.valorAtual)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-texto-secundario">Ano anterior</p>
            <p className="text-lg font-semibold text-texto-principal/70">
              {formatarMoeda(bloco.valorAnoAnterior)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-texto-secundario">Variação</p>
            <span
              className={
                temQueda
                  ? "inline-flex items-center gap-1 rounded-md bg-acento-vermelhoClaro px-2 py-0.5 text-sm font-bold text-acento-alerta"
                  : "inline-flex items-center gap-1 rounded-md bg-acento-verdeClaro px-2 py-0.5 text-sm font-bold text-acento-sucesso"
              }
            >
              {temQueda ? "↓" : "↑"} {Math.abs(variacao).toFixed(1)}%
            </span>
          </div>
        </div>
        <GraficoBrushFaturamento serieAtual={bloco.serieDiariaAtual} />
      </div>
    </CartaoVidro>
  );
}
