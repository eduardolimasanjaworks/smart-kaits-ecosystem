"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Target } from "lucide-react";
import { urlApiCrm } from "@/lib/crm/urlApiCrm";
import mesclarClasses from "@/lib/utils/mesclarClasses";

type MetaApi = {
  id: string;
  periodo: "SEMANAL" | "MENSAL";
  inicioPeriodo: string;
  valorAlvoBrlCentavos: number;
  valorAtingidoBrlCentavos: number;
  percentualAtingido: number;
  criadoEm: string;
};

function formatarBrl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rotuloPeriodo(periodo: MetaApi["periodo"]) {
  return periodo === "SEMANAL" ? "Semanal" : "Mensal";
}

export default function MetasVendas() {
  const [metas, setMetas] = useState<MetaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"SEMANAL" | "MENSAL">("MENSAL");
  const [inicioPeriodo, setInicioPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [valorAlvo, setValorAlvo] = useState(50000);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/metas`);
      if (!res.ok) throw new Error("Falha ao listar metas");
      const dados = (await res.json()) as { metas: MetaApi[] };
      setMetas(dados.metas ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/metas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo,
          inicioPeriodo,
          valorAlvoBrlCentavos: Math.round(valorAlvo * 100),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { erro?: string };
        throw new Error(j.erro ?? "Não foi possível criar meta");
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar meta");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-texto-principal">Metas de vendas</h2>
          <p className="text-sm font-medium leading-relaxed text-slate-900">
            Compare o faturamento ganho (negociações GANHA) com a meta do período.
          </p>
        </div>
        <Target className="hidden h-10 w-10 text-acento-marca sm:block" aria-hidden />
      </div>

      {erro && (
        <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {erro}
        </div>
      )}

      <form
        onSubmit={criar}
        className="mb-10 grid gap-4 rounded-2xl border border-borda-sutil bg-white p-6 shadow-cartao sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Período
          </label>
          <select
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as "SEMANAL" | "MENSAL")}
          >
            <option value="MENSAL">Mensal</option>
            <option value="SEMANAL">Semanal</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Início do período
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal"
            value={inicioPeriodo}
            onChange={(e) => setInicioPeriodo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Meta (R$)
          </label>
          <input
            type="number"
            min={1}
            step={100}
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal"
            value={valorAlvo}
            onChange={(e) => setValorAlvo(Number(e.target.value))}
            required
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#E65F00]"
          >
            <Plus className="h-4 w-4" />
            Criar meta
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-borda-sutil bg-white shadow-cartao ring-1 ring-black/[0.04]">
        <div className="flex items-center justify-between border-b border-borda-sutil px-6 py-4">
          <span className="text-sm font-bold uppercase tracking-widest text-slate-900">Metas</span>
          <button type="button" onClick={() => void carregar()} className="text-xs font-semibold text-acento-marca hover:underline">
            Atualizar
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-texto-secundario">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : metas.length === 0 ? (
          <p className="py-16 text-center text-sm text-texto-secundario">Nenhuma meta cadastrada.</p>
        ) : (
          <ul className="divide-y divide-borda-sutil">
            {metas.map((m) => {
              const pct = Math.min(m.percentualAtingido, 100);
              const corBarra =
                m.percentualAtingido >= 100 ? "bg-emerald-500" : m.percentualAtingido >= 70 ? "bg-amber-500" : "bg-red-500";
              return (
                <li key={m.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-texto-principal">
                        {rotuloPeriodo(m.periodo)} — {m.inicioPeriodo}
                      </span>
                      <p className="text-xs text-texto-secundario">
                        Meta {formatarBrl(m.valorAlvoBrlCentavos)} · Atingido {formatarBrl(m.valorAtingidoBrlCentavos)}
                      </p>
                    </div>
                    <span
                      className={mesclarClasses(
                        "text-lg font-black tabular-nums",
                        m.percentualAtingido >= 100 ? "text-emerald-400" : "text-texto-principal",
                      )}
                    >
                      {m.percentualAtingido}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={mesclarClasses("h-full rounded-full transition-all", corBarra)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
