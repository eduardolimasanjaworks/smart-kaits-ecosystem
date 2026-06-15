// Lista Top N com expansão para detalhar valor e unidades sem poluir o modo TV/mobile.
"use client";

import type { ItemRanking } from "@/dominio/contratos/tiposKpi";
import mesclarClasses from "@/lib/utils/mesclarClasses";
import { useState } from "react";

type PropriedadesListaRankingExpansivel = {
  titulo: string;
  itens: ItemRanking[];
};

export default function ListaRankingExpansivel({
  titulo,
  itens,
}: PropriedadesListaRankingExpansivel) {
  const [indiceAberto, definirIndiceAberto] = useState<number | null>(null);

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-texto-secundario">
        {titulo}
      </p>
      <ol className="space-y-1">
        {itens.map((item, indice) => {
          const aberto = indiceAberto === indice;
          return (
            <li key={item.nome}>
              <button
                type="button"
                onClick={() => definirIndiceAberto(aberto ? null : indice)}
                className={mesclarClasses(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors",
                  aberto
                    ? "border-l-2 border-l-acento-roxo bg-fundo-profundo pl-1.5"
                    : "hover:bg-fundo-profundo",
                )}
              >
                <span className="text-xs font-medium text-texto-principal">
                  {indice + 1}. {item.nome}
                </span>
                <span className="text-xs font-semibold text-texto-secundario">
                  {item.valorReais.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </button>
              {aberto ? (
                <div className="px-2 pb-1.5 text-[11px] font-medium text-texto-secundario">
                  Unidades aproximadas: {item.unidades}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
