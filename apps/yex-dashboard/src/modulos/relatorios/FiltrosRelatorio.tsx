"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarRange, Loader2, Search, User } from "lucide-react";
import type { FiltroRelatorio, ResultadoNegociacao } from "./tiposFiltroRelatorio";
import { urlApiCrm } from "./urlApiCrm";

type LeadResumo = { id: string; nomeContato?: string; nome?: string };

type Props = {
  valor: FiltroRelatorio;
  onChange: (valor: FiltroRelatorio) => void;
};

const OPCOES_RESULTADO: { valor: "" | ResultadoNegociacao; rotulo: string }[] = [
  { valor: "", rotulo: "Todos os resultados" },
  { valor: "ABERTA", rotulo: "Abertas (pipeline)" },
  { valor: "GANHA", rotulo: "Ganhas" },
  { valor: "PERDIDA", rotulo: "Perdidas" },
  { valor: "ARQUIVADA", rotulo: "Arquivadas" },
];

function rotuloLead(lead: LeadResumo) {
  return lead.nomeContato ?? lead.nome ?? "Sem nome";
}

export default function FiltrosRelatorio({ valor, onChange }: Props) {
  const [buscaLead, setBuscaLead] = useState("");
  const [sugestoes, setSugestoes] = useState<LeadResumo[]>([]);
  const [buscandoLeads, setBuscandoLeads] = useState(false);
  const [listaAberta, setListaAberta] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resultadoAtual = valor.resultados?.[0] ?? "";

  const buscarLeads = useCallback(async (termo: string) => {
    if (termo.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    setBuscandoLeads(true);
    try {
      const qs = new URLSearchParams({ q: termo.trim(), limit: "15" });
      const res = await fetch(`${urlApiCrm()}/leads?${qs}`);
      if (!res.ok) {
        setSugestoes([]);
        return;
      }
      const dados = (await res.json()) as { leads?: LeadResumo[] };
      setSugestoes(dados.leads ?? []);
    } catch {
      setSugestoes([]);
    } finally {
      setBuscandoLeads(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void buscarLeads(buscaLead), 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaLead, buscarLeads]);

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setListaAberta(false);
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const selecionarLead = (lead: LeadResumo) => {
    setBuscaLead(rotuloLead(lead));
    onChange({ ...valor, leadId: lead.id });
    setListaAberta(false);
  };

  const limparLead = () => {
    setBuscaLead("");
    const { leadId: _l, ...resto } = valor;
    onChange(resto);
  };

  return (
    <section className="rounded-2xl border border-borda-sutil bg-fundo-container p-4 shadow-cartao sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-[#FF6B00]" aria-hidden />
        <h2 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
          Filtros do relatório
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-texto-secundario">Início</span>
          <input
            type="date"
            value={valor.inicio}
            onChange={(e) => onChange({ ...valor, inicio: e.target.value })}
            className="rounded-xl border border-borda-sutil bg-fundo-base px-3 py-2.5 text-sm text-texto-principal outline-none ring-[#FF6B00]/30 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-texto-secundario">Fim</span>
          <input
            type="date"
            value={valor.fim}
            onChange={(e) => onChange({ ...valor, fim: e.target.value })}
            className="rounded-xl border border-borda-sutil bg-fundo-base px-3 py-2.5 text-sm text-texto-principal outline-none ring-[#FF6B00]/30 focus:ring-2"
          />
        </label>
        <div ref={containerRef} className="relative flex flex-col gap-1.5">
          <span className="text-xs font-bold text-texto-secundario">Cliente</span>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-secundario" />
            <input
              type="text"
              value={buscaLead}
              onChange={(e) => {
                setBuscaLead(e.target.value);
                onChange({ ...valor, leadId: undefined });
                setListaAberta(true);
              }}
              onFocus={() => setListaAberta(true)}
              placeholder="Buscar por nome…"
              className="w-full rounded-xl border border-borda-sutil bg-fundo-base py-2.5 pl-10 pr-10 text-sm text-texto-principal outline-none ring-[#FF6B00]/30 focus:ring-2"
            />
            {buscandoLeads ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#FF6B00]" />
            ) : (
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-secundario" />
            )}
          </div>
          {listaAberta && sugestoes.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-borda-sutil bg-white py-1 shadow-cartaoHover">
              {sugestoes.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => selecionarLead(lead)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[#FF6B00]/10"
                  >
                    {rotuloLead(lead)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {valor.leadId && (
            <button
              type="button"
              onClick={limparLead}
              className="text-left text-xs font-semibold text-[#FF6B00] hover:underline"
            >
              Limpar cliente
            </button>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-texto-secundario">Resultado</span>
          <select
            value={resultadoAtual}
            onChange={(e) => {
              const v = e.target.value as "" | ResultadoNegociacao;
              onChange({
                ...valor,
                resultados: v ? [v] : undefined,
              });
            }}
            className="rounded-xl border border-borda-sutil bg-fundo-base px-3 py-2.5 text-sm text-texto-principal outline-none ring-[#FF6B00]/30 focus:ring-2"
          >
            {OPCOES_RESULTADO.map((op) => (
              <option key={op.valor || "todos"} value={op.valor}>
                {op.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
