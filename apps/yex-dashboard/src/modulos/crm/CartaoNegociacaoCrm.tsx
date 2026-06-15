"use client";

import { useDraggable } from "@dnd-kit/core";
import { centavosParaReais } from "./crmApi";
import type { NegociacaoKanban } from "./tiposNegociacao";

type Props = { neg: NegociacaoKanban; onAbrir: (id: string) => void };

export default function CartaoNegociacaoCrm({ neg, onAbrir }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: neg.id });
  const estilo = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={estilo}
      className={`rounded-xl border border-borda-sutil bg-white p-3 shadow-sm ${isDragging ? "opacity-60" : ""}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <p className="text-sm font-bold text-texto-principal">{neg.titulo}</p>
        <p className="text-xs font-semibold text-texto-principal">{neg.leadNome}</p>
        {neg.descricao ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-texto-secundario">{neg.descricao}</p>
        ) : null}
        <p className="mt-1 text-sm font-semibold text-emerald-700">
          {centavosParaReais(neg.valorEstimadoBrlCentavos)}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAbrir(neg.id);
        }}
        className="mt-2 w-full rounded-lg border border-borda-sutil py-1 text-xs font-bold text-acento-marca hover:bg-acento-marca/5"
      >
        Abrir
      </button>
    </div>
  );
}
