"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, User } from "lucide-react";
import { urlApiCrm } from "../urlApiCrm";

type LeadResumo = { id: string; nomeContato?: string; nome?: string };

type Props = {
  leadId?: string;
  onSelecionar: (leadId: string, rotulo: string) => void;
  onLimpar: () => void;
};

function rotuloLead(lead: LeadResumo) {
  return lead.nomeContato ?? lead.nome ?? "Sem nome";
}

export default function SeletorClienteRelatorio({ leadId, onSelecionar, onLimpar }: Props) {
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<LeadResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberta, setAberta] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buscarLeads = useCallback(async (termo: string) => {
    if (termo.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    setBuscando(true);
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
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void buscarLeads(busca), 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca, buscarLeads]);

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberta(false);
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div ref={containerRef} className="relative max-w-md">
      <label className="mb-1.5 block text-xs font-bold text-texto-secundario">Cliente</label>
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-secundario" />
        <input
          type="text"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          placeholder="Buscar por nome…"
          className="w-full rounded-xl border border-borda-sutil bg-fundo-base py-2.5 pl-10 pr-10 text-sm outline-none ring-[#FF6B00]/30 focus:ring-2"
        />
        {buscando ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#FF6B00]" />
        ) : (
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-secundario" />
        )}
      </div>
      {aberta && sugestoes.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-borda-sutil bg-white py-1 shadow-cartaoHover">
          {sugestoes.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => {
                  const rotulo = rotuloLead(lead);
                  setBusca(rotulo);
                  onSelecionar(lead.id, rotulo);
                  setAberta(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[#FF6B00]/10"
              >
                {rotuloLead(lead)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {leadId && (
        <button
          type="button"
          onClick={() => {
            setBusca("");
            onLimpar();
          }}
          className="mt-1 text-xs font-semibold text-[#FF6B00] hover:underline"
        >
          Limpar seleção
        </button>
      )}
    </div>
  );
}
