"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { FiltroRelatorio } from "./tiposFiltroRelatorio";
import { montarQueryFiltros } from "./montarQueryFiltros";
import { urlApiCrm } from "./urlApiCrm";

type LinhaApi = {
  id: string;
  titulo: string;
  cliente: string;
  coluna: string;
  resultado: string;
  valorEstimadoBrlCentavos: number;
  valorFechadoBrlCentavos: number | null;
  criadoEm: string;
  atualizadoEm: string;
};

type LinhaNegociacao = {
  id: string;
  titulo: string;
  clienteNome: string;
  colunaTitulo: string;
  resultado: string;
  valorEstimadoBrlCentavos: number;
  valorFechadoBrlCentavos: number | null;
  criadoEm: string;
  atualizadoEm: string;
};

function normalizarLinha(n: LinhaApi): LinhaNegociacao {
  return {
    id: n.id,
    titulo: n.titulo,
    clienteNome: n.cliente,
    colunaTitulo: n.coluna,
    resultado: n.resultado,
    valorEstimadoBrlCentavos: n.valorEstimadoBrlCentavos,
    valorFechadoBrlCentavos: n.valorFechadoBrlCentavos,
    criadoEm: n.criadoEm,
    atualizadoEm: n.atualizadoEm,
  };
}

type Props = { filtros: FiltroRelatorio };

function brl(centavos: number | null) {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function TabelaNegociacoes({ filtros }: Props) {
  const [itens, setItens] = useState<LinhaNegociacao[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorsAnteriores, setCursorsAnteriores] = useState<string[]>([]);
  const [cursorProximo, setCursorProximo] = useState<string | null>(null);
  const [temProxima, setTemProxima] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const qs = montarQueryFiltros(filtros);
      const sep = qs ? "&" : "?";
      const pag = new URLSearchParams({ limite: "25" });
      if (cursor) pag.set("cursor", cursor);
      const r = await fetch(
        `${urlApiCrm()}/relatorios/negociacoes${qs}${sep}${pag.toString()}`,
      );
      if (!r.ok) throw new Error();
      const j = (await r.json()) as {
        itens?: LinhaApi[];
        paginacao?: { cursorProximo?: string | null; temProximaPagina?: boolean };
      };
      setItens((j.itens ?? []).map(normalizarLinha));
      setCursorProximo(j.paginacao?.cursorProximo ?? null);
      setTemProxima(Boolean(j.paginacao?.temProximaPagina));
    } catch {
      setItens([]);
      setCursorProximo(null);
      setTemProxima(false);
      setErro("Tabela indisponível. Verifique /relatorios/negociacoes.");
    } finally {
      setCarregando(false);
    }
  }, [filtros, cursor]);

  useEffect(() => {
    setCursor(undefined);
    setCursorsAnteriores([]);
  }, [filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const exportarPdf = async () => {
    setExportando(true);
    try {
      const r = await fetch(`${urlApiCrm()}/relatorios/pdf${montarQueryFiltros(filtros)}`);
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-negociacoes.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Exportação PDF falhou. Verifique /relatorios/pdf.");
    } finally {
      setExportando(false);
    }
  };

  const irProxima = () => {
    if (!cursorProximo) return;
    setCursorsAnteriores((h) => [...h, cursor ?? ""]);
    setCursor(cursorProximo);
  };

  const irAnterior = () => {
    if (cursorsAnteriores.length === 0) return;
    const anterior = cursorsAnteriores[cursorsAnteriores.length - 1];
    setCursorsAnteriores((h) => h.slice(0, -1));
    setCursor(anterior || undefined);
  };

  const mostrarPaginacao = cursorsAnteriores.length > 0 || temProxima;

  return (
    <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
          Negociações ({itens.length}
          {temProxima ? "+" : ""})
        </h3>
        <button
          type="button"
          onClick={() => void exportarPdf()}
          disabled={exportando}
          className="inline-flex items-center gap-2 rounded-xl bg-acento-marca px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {exportando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Exportar PDF
        </button>
      </div>
      {carregando && (
        <p className="flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando tabela…
        </p>
      )}
      {erro && !carregando && <p className="text-sm text-amber-700">{erro}</p>}
      {!carregando && itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-borda-sutil text-xs uppercase text-texto-secundario">
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Coluna</th>
                <th className="py-2 pr-3">Resultado</th>
                <th className="py-2 pr-3">Estimado</th>
                <th className="py-2 pr-3">Fechado</th>
                <th className="py-2">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((n) => (
                <tr key={n.id} className="border-b border-borda-sutil/60">
                  <td className="py-2 pr-3 font-semibold">{n.titulo}</td>
                  <td className="py-2 pr-3">{n.clienteNome}</td>
                  <td className="py-2 pr-3">{n.colunaTitulo}</td>
                  <td className="py-2 pr-3">{n.resultado}</td>
                  <td className="py-2 pr-3">{brl(n.valorEstimadoBrlCentavos)}</td>
                  <td className="py-2 pr-3">{brl(n.valorFechadoBrlCentavos)}</td>
                  <td className="py-2">{dataCurta(n.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mostrarPaginacao && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={cursorsAnteriores.length === 0}
            onClick={irAnterior}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!temProxima}
            onClick={irProxima}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}
