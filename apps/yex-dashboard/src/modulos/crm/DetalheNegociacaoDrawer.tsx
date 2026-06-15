"use client";

import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import FormProdutosNegociacao from "./FormProdutosNegociacao";
import { datetimeLocalParaIso, isoParaDatetimeLocal, reaisParaCentavos, urlApiCrm } from "./crmApi";
import type { DetalheNegociacao, LinhaProduto, ProdutoCatalogo } from "./tiposNegociacao";

type Props = { negociacaoId: string | null; onFechar: () => void; onSalvo: () => void };

export default function DetalheNegociacaoDrawer({ negociacaoId, onFechar, onSalvo }: Props) {
  const [detalhe, setDetalhe] = useState<DetalheNegociacao | null>(null);
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorEst, setValorEst] = useState("");
  const [valorFech, setValorFech] = useState("");
  const [dataHoraEventoLocal, setDataHoraEventoLocal] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [linhas, setLinhas] = useState<LinhaProduto[]>([]);

  const carregar = useCallback(async () => {
    if (!negociacaoId) return;
    setCarregando(true);
    try {
      const [resDet, resCat] = await Promise.all([
        fetch(`${urlApiCrm()}/negociacoes/${negociacaoId}/detalhe`),
        fetch(`${urlApiCrm()}/produtos`),
      ]);
      const d = (await resDet.json()) as DetalheNegociacao;
      const cat = (await resCat.json()) as { produtos: ProdutoCatalogo[] };
      setDetalhe(d);
      setCatalogo(cat.produtos ?? []);
      setTitulo(d.negociacao.titulo);
      setDescricao(d.negociacao.descricao ?? "");
      setValorEst(String(d.negociacao.valorEstimadoBrlCentavos / 100));
      setValorFech(String(d.negociacao.valorFechadoBrlCentavos / 100));
      const mes = d.negociacao.mesPrevistoEvento?.slice(0, 10);
      setDataHoraEventoLocal(
        d.negociacao.dataHoraPrevistoEvento
          ? isoParaDatetimeLocal(d.negociacao.dataHoraPrevistoEvento)
          : mes
            ? `${mes}T09:00`
            : "",
      );
      setMotivoPerda(d.negociacao.motivoPerda ?? "");
      setLinhas(
        d.produtos.map((p) => ({
          produtoId: p.produtoId,
          quantidade: p.quantidade,
          precoUnitarioBrlCentavos: p.precoUnitarioBrlCentavos,
        })),
      );
    } finally {
      setCarregando(false);
    }
  }, [negociacaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async (patch: Record<string, unknown>) => {
    if (!negociacaoId) return;
    setSalvando(true);
    try {
      await fetch(`${urlApiCrm()}/negociacoes/${negociacaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onSalvo();
      await carregar();
    } finally {
      setSalvando(false);
    }
  };

  if (!negociacaoId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar}>
      <aside
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-black">Negociação</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {carregando ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-acento-marca" />
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {detalhe?.lead && (
              <p className="text-sm text-texto-secundario">
                Cliente: <strong>{detalhe.lead.nomeContato}</strong>
              </p>
            )}
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="Valor estimado (R$)"
                value={valorEst}
                onChange={(e) => setValorEst(e.target.value)}
              />
              <input
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="Valor fechado (R$)"
                value={valorFech}
                onChange={(e) => setValorFech(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-bold text-slate-800">Data e hora do evento</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={dataHoraEventoLocal}
                onChange={(e) => setDataHoraEventoLocal(e.target.value)}
              />
            </div>
            <FormProdutosNegociacao linhas={linhas} catalogo={catalogo} onChange={setLinhas} />
            {detalhe?.tempoPorColunaResumo.length ? (
              <ul className="space-y-1 text-xs text-texto-secundario">
                {detalhe.tempoPorColunaResumo.map((t) => (
                  <li key={t.colunaId}>
                    {t.titulo}: {t.diasNaColuna} dia(s)
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm"
              rows={2}
              placeholder="Motivo da perda"
              value={motivoPerda}
              onChange={(e) => setMotivoPerda(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  void salvar({
                    titulo,
                    descricao: descricao || null,
                    valorEstimadoBrlCentavos: reaisParaCentavos(valorEst),
                    valorFechadoBrlCentavos: reaisParaCentavos(valorFech),
                    dataHoraPrevistoEvento: dataHoraEventoLocal
                      ? datetimeLocalParaIso(dataHoraEventoLocal)
                      : null,
                    produtos: linhas,
                  })
                }
                className="rounded-xl bg-acento-marca px-4 py-2 text-sm font-bold text-white"
              >
                Salvar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  void salvar({
                    resultado: "GANHA",
                    valorFechadoBrlCentavos: reaisParaCentavos(valorFech || valorEst),
                  })
                }
                className="rounded-xl border border-green-600 px-4 py-2 text-sm font-bold text-green-700"
              >
                Ganha
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  if (!motivoPerda.trim()) {
                    alert("Informe o motivo da perda.");
                    return;
                  }
                  void salvar({
                    resultado: "PERDIDA",
                    motivoPerda: motivoPerda.trim(),
                    valorFechadoBrlCentavos: reaisParaCentavos(valorFech || valorEst),
                  });
                }}
                className="rounded-xl border border-red-500 px-4 py-2 text-sm font-bold text-red-600"
              >
                Perdida
              </button>
            </div>
            <p className="text-xs text-texto-secundario">Status: {detalhe?.negociacao.resultado}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
