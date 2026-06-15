"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileDown, Loader2 } from "lucide-react";
import type { FiltroRelatorio } from "../tiposFiltroRelatorio";
import { montarQueryFiltros } from "../montarQueryFiltros";
import { urlApiCrm } from "../urlApiCrm";
import { formatarMoedaCentavos } from "../formatacaoRelatorio";
import SeletorClienteRelatorio from "./SeletorClienteRelatorio";

type DetalheCliente = {
  lead: {
    id: string;
    nomeContato: string;
    emailContato?: string | null;
    telefoneContato?: string | null;
  };
  totais: {
    ganhoBrlCentavos: number;
    abertoBrlCentavos: number;
    perdidoBrlCentavos: number;
  };
  negociacoes: Array<{
    id: string;
    titulo: string;
    resultado: string;
    valorEstimadoBrlCentavos: number;
    valorFechadoBrlCentavos: number;
    criadoEm: string;
  }>;
};

type Props = { filtros: FiltroRelatorio };

export default function VisaoCliente({ filtros }: Props) {
  const [leadId, setLeadId] = useState<string | undefined>();
  const [detalhe, setDetalhe] = useState<DetalheCliente | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setDetalhe(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const r = await fetch(
          `${urlApiCrm()}/relatorios/cliente/${leadId}${montarQueryFiltros(filtros)}`,
        );
        if (!r.ok) throw new Error();
        const dados = (await r.json()) as DetalheCliente;
        if (ativo) setDetalhe(dados);
      } catch {
        if (ativo) {
          setDetalhe(null);
          setErro("Cliente não encontrado ou sem dados no período.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [leadId, filtros]);

  const urlPdf = leadId ? `${urlApiCrm()}/relatorios/cliente/${leadId}/pdf` : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-secundario">
        Escolha um cliente para ver negociações, totais e exportar PDF.
      </p>

      <SeletorClienteRelatorio
        leadId={leadId}
        onSelecionar={(id) => setLeadId(id)}
        onLimpar={() => setLeadId(undefined)}
      />

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF6B00]" /> Carregando cliente…
        </p>
      )}

      {erro && !carregando && (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-amber-700">
          {erro}
        </p>
      )}

      {detalhe && !carregando && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#FF6B00]/30 bg-gradient-to-br from-[#FF6B00]/5 to-white p-5">
            <div>
              <h2 className="text-xl font-black text-texto-principal">{detalhe.lead.nomeContato}</h2>
              {detalhe.lead.emailContato && (
                <p className="text-sm text-texto-secundario">{detalhe.lead.emailContato}</p>
              )}
              {detalhe.lead.telefoneContato && (
                <p className="text-sm text-texto-secundario">{detalhe.lead.telefoneContato}</p>
              )}
            </div>
            {urlPdf && (
              <a
                href={urlPdf}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2 text-sm font-bold text-white hover:bg-[#e55f00]"
              >
                <FileDown className="h-4 w-4" />
                Baixar PDF
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-xl border border-borda-sutil bg-fundo-container p-4">
              <p className="text-xs font-bold uppercase text-texto-secundario">Ganho</p>
              <p className="mt-1 text-xl font-black text-emerald-700">
                {formatarMoedaCentavos(detalhe.totais.ganhoBrlCentavos)}
              </p>
            </article>
            <article className="rounded-xl border border-borda-sutil bg-fundo-container p-4">
              <p className="text-xs font-bold uppercase text-texto-secundario">Em aberto</p>
              <p className="mt-1 text-xl font-black text-[#FF6B00]">
                {formatarMoedaCentavos(detalhe.totais.abertoBrlCentavos)}
              </p>
            </article>
            <article className="rounded-xl border border-borda-sutil bg-fundo-container p-4">
              <p className="text-xs font-bold uppercase text-texto-secundario">Perdido</p>
              <p className="mt-1 text-xl font-black text-texto-principal">
                {formatarMoedaCentavos(detalhe.totais.perdidoBrlCentavos)}
              </p>
            </article>
          </div>

          <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
              Negociações ({detalhe.negociacoes.length})
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-texto-secundario">
                    <th className="py-2 pr-3">Título</th>
                    <th className="py-2 pr-3">Resultado</th>
                    <th className="py-2 pr-3">Estimado</th>
                    <th className="py-2">Fechado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.negociacoes.map((n) => (
                    <tr key={n.id} className="border-b border-borda-sutil/60">
                      <td className="py-2 pr-3 font-medium">{n.titulo}</td>
                      <td className="py-2 pr-3">{n.resultado}</td>
                      <td className="py-2 pr-3">
                        {formatarMoedaCentavos(n.valorEstimadoBrlCentavos)}
                      </td>
                      <td className="py-2">
                        {n.valorFechadoBrlCentavos
                          ? formatarMoedaCentavos(n.valorFechadoBrlCentavos)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
