// Cards separados do restaurante: Seg–Qui e Sex–Dom.
import type { BlocoRestaurante } from "@/dominio/contratos/tiposKpi";
import CartaoVidro from "@/modulos/compartilhado/CartaoVidro";

type PropriedadesCartaoRestaurante = {
  bloco: BlocoRestaurante;
};

export function CartaoRestauranteSemana({ bloco }: PropriedadesCartaoRestaurante) {
  return (
    <CartaoVidro titulo="Restaurante (Seg–Qui)">
      <div className="flex h-full flex-col justify-center gap-3">
        <Metrica titulo="Faturamento" valor={formatarMoeda(bloco.faturamentoSegundaQuinta)} />
        <Metrica titulo="Ticket médio" valor={formatarMoeda(bloco.ticketMedioSegundaQuinta)} />
        <Metrica titulo="Quantidade (aprox.)" valor={String(bloco.quantidadeSegundaQuinta)} />
      </div>
    </CartaoVidro>
  );
}

export function CartaoRestauranteFimDeSemana({ bloco }: PropriedadesCartaoRestaurante) {
  return (
    <CartaoVidro titulo="Restaurante (Sex–Dom)">
      <div className="flex h-full flex-col justify-center gap-3">
        <Metrica titulo="Faturamento" valor={formatarMoeda(bloco.faturamentoSextaDomingo)} />
        <Metrica titulo="Ticket médio" valor={formatarMoeda(bloco.ticketMedioSextaDomingo)} />
        <Metrica titulo="Quantidade (aprox.)" valor={String(bloco.quantidadeSextaDomingo)} />
      </div>
    </CartaoVidro>
  );
}

type PropriedadesMetrica = {
  titulo: string;
  valor: string;
};

function Metrica({ titulo, valor }: PropriedadesMetrica) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-borda-sutil py-2 last:border-0">
      <span className="text-xs font-medium text-texto-secundario">{titulo}</span>
      <span className="text-sm font-semibold text-texto-principal">{valor}</span>
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
