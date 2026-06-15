"use client";

import type { LinhaProduto, ProdutoCatalogo } from "./tiposNegociacao";

type Props = {
  linhas: LinhaProduto[];
  catalogo: ProdutoCatalogo[];
  onChange: (linhas: LinhaProduto[]) => void;
};

export default function FormProdutosNegociacao({ linhas, catalogo, onChange }: Props) {
  if (!catalogo.length) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-black uppercase text-texto-secundario">Produtos</h3>
      {linhas.map((l, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <select
            className="flex-1 rounded-lg border px-2 py-1 text-xs"
            value={l.produtoId}
            onChange={(e) => {
              const p = catalogo.find((c) => c.id === e.target.value);
              const next = [...linhas];
              next[i] = {
                ...l,
                produtoId: e.target.value,
                precoUnitarioBrlCentavos: p?.precoReferenciaBrlCentavos ?? l.precoUnitarioBrlCentavos,
              };
              onChange(next);
            }}
          >
            {catalogo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="w-14 rounded-lg border px-2 py-1 text-xs"
            value={l.quantidade}
            onChange={(e) => {
              const next = [...linhas];
              next[i] = { ...l, quantidade: Number(e.target.value) || 1 };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-xs text-red-500"
            onClick={() => onChange(linhas.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-bold text-acento-marca"
        onClick={() =>
          onChange([
            ...linhas,
            {
              produtoId: catalogo[0].id,
              quantidade: 1,
              precoUnitarioBrlCentavos: catalogo[0].precoReferenciaBrlCentavos,
            },
          ])
        }
      >
        + Adicionar produto
      </button>
    </section>
  );
}
