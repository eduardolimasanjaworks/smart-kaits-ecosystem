"use client";
import React from "react";

type FatiasComposicao = {
  restaurante: number;
  boliche: number;
  eventos: number;
};

type PropriedadesCartaoAnoIndividual = {
  titulo: string;
  fatias: FatiasComposicao;
};

export default function CartaoAnoIndividual({ titulo, fatias }: PropriedadesCartaoAnoIndividual) {
  const total = fatias.restaurante + fatias.boliche + fatias.eventos;
  const pct = (valor: number) => `${Math.round((valor / total) * 100)}%`;

  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-cartao ring-1 ring-black/[0.03]">
      <div className="mb-4 border-b border-slate-200 pb-3">
        <h3 className="text-base font-black text-texto-principal">
          Composição <span className="text-[#FF6B00]">{titulo}</span>
        </h3>
        <p className="mt-1 text-xs font-semibold text-slate-800">Participação relativa por canal</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        <ItemProporcao cor="#FF6B00" rotulo="Restaurante" largura={pct(fatias.restaurante)} />
        <ItemProporcao cor="#FFD100" rotulo="Boliche" largura={pct(fatias.boliche)} />
        <ItemProporcao cor="#86B9FF" rotulo="Eventos" largura={pct(fatias.eventos)} />
      </div>
    </div>
  );
}

function ItemProporcao({ cor, rotulo, largura }: { cor: string; rotulo: string; largura: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-2">
        <span className="text-xs font-semibold text-slate-800">{rotulo}</span>
        <span className="text-sm font-black tabular-nums text-texto-principal">{largura}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: largura, backgroundColor: cor }} />
      </div>
    </div>
  );
}
