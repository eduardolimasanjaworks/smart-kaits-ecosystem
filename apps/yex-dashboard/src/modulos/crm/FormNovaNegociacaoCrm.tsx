"use client";

import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { datetimeLocalParaIso, reaisParaCentavos, urlApiCrm } from "./crmApi";
import type { ProdutoCatalogo } from "./tiposNegociacao";

type LeadItem = {
  id: string;
  nomeContato: string;
  telefoneContato: string | null;
};

type Props = {
  quadroId: string;
  colunaId: string;
  etiquetaEtapa: string;
  onCriada: () => void;
  onCancel: () => void;
};

/**
 * Formulário de nova negociação no contexto da coluna do Kanban:
 * cliente existente ou novo, pacote do catálogo ou cadastro rápido, data/hora do evento.
 */
export default function FormNovaNegociacaoCrm({
  quadroId,
  colunaId,
  etiquetaEtapa,
  onCriada,
  onCancel,
}: Props) {
  const raiz = urlApiCrm().replace(/\/$/, "");

  const [modoLead, setModoLead] = useState<"existente" | "novo">("existente");
  const [buscaLead, setBuscaLead] = useState("");
  const [leadsOp, setLeadsOp] = useState<LeadItem[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [nomeNovoLead, setNomeNovoLead] = useState("");
  const [whatsappNovo, setWhatsappNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");

  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [criarPacote, setCriarPacote] = useState(false);
  const [nomePacote, setNomePacote] = useState("");
  const [precoPacoteReais, setPrecoPacoteReais] = useState("");
  const [quantidade, setQuantidade] = useState(1);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataHoraLocal, setDataHoraLocal] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [buscandoLeads, setBuscandoLeads] = useState(false);

  const carregarCatalogo = useCallback(async () => {
    const r = await fetch(`${raiz}/produtos`, { credentials: "same-origin" });
    const j = (await r.json()) as { produtos?: ProdutoCatalogo[] };
    setCatalogo(j.produtos ?? []);
  }, [raiz]);

  useEffect(() => {
    void carregarCatalogo();
  }, [carregarCatalogo]);

  useEffect(() => {
    if (modoLead !== "existente") {
      setLeadsOp([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setBuscandoLeads(true);
        try {
          const q = buscaLead.trim() ? `&q=${encodeURIComponent(buscaLead.trim())}` : "";
          const r = await fetch(`${raiz}/leads?limit=40&offset=0${q}`, {
            credentials: "same-origin",
          });
          const j = (await r.json()) as { leads?: LeadItem[] };
          setLeadsOp(Array.isArray(j.leads) ? j.leads : []);
        } finally {
          setBuscandoLeads(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [buscaLead, modoLead, raiz]);

  const produtoNome = produtoId
    ? catalogo.find((p) => p.id === produtoId)?.nome ?? ""
    : "";
  const leadNomeUi =
    modoLead === "novo"
      ? nomeNovoLead.trim()
      : leadsOp.find((l) => l.id === leadId)?.nomeContato ?? "";

  useEffect(() => {
    if (!titulo.trim() && produtoNome && leadNomeUi) {
      setTitulo(`${leadNomeUi} · ${produtoNome}`);
    }
  }, [leadNomeUi, produtoNome, titulo]);

  const resolveLeadId = async (): Promise<string> => {
    if (modoLead === "existente") {
      if (!leadId) throw new Error("lead");
      return leadId;
    }
    const whats = whatsappNovo.replace(/\D/g, "");
    if (nomeNovoLead.trim().length < 2 || whats.length < 10) throw new Error("lead-novo");
    const body: Record<string, unknown> = {
      nomeContato: nomeNovoLead.trim(),
      telefoneContato: whatsappNovo.trim(),
      emailContato: emailNovo.trim() ? emailNovo.trim() : null,
    };
    const r = await fetch(`${raiz}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("lead-api");
    const j = (await r.json()) as { lead?: { id: string } };
    if (!j.lead?.id) throw new Error("lead-api");
    return j.lead.id;
  };

  const resolveProdutoId = async (): Promise<{ id: string; precoRefCent: number }> => {
    if (criarPacote) {
      const nome = nomePacote.trim();
      const precoC = reaisParaCentavos(precoPacoteReais);
      if (nome.length < 2 || precoC <= 0) throw new Error("produto-novo");
      const r = await fetch(`${raiz}/produtos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          nome,
          codigoSku: null,
          precoReferenciaBrlCentavos: precoC,
        }),
      });
      if (!r.ok) throw new Error("produto-api");
      const j = (await r.json()) as { produto?: { id: string; precoReferenciaBrlCentavos: number } };
      if (!j.produto?.id) throw new Error("produto-api");
      await carregarCatalogo();
      return { id: j.produto.id, precoRefCent: j.produto.precoReferenciaBrlCentavos };
    }
    if (!produtoId) throw new Error("produto");
    const p = catalogo.find((x) => x.id === produtoId);
    if (!p) throw new Error("produto");
    return { id: produtoId, precoRefCent: p.precoReferenciaBrlCentavos };
  };

  const criar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!dataHoraLocal.trim()) return;
    setSalvando(true);
    try {
      const lid = await resolveLeadId();
      const { id: pid, precoRefCent } = await resolveProdutoId();
      const q = Math.max(1, Math.floor(quantidade));
      const precoUnit = precoRefCent;
      const valorEstimado = q * precoUnit;

      const negRes = await fetch(`${raiz}/negociacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          leadId: lid,
          quadroId,
          colunaId,
          titulo: titulo.trim() || `${leadNomeUi} · ${produtoNome || "Pacote"}`,
          descricao: descricao.trim() || null,
          valorEstimadoBrlCentavos: valorEstimado,
          valorFechadoBrlCentavos: 0,
          dataHoraPrevistoEvento: datetimeLocalParaIso(dataHoraLocal),
          produtos: [{ produtoId: pid, quantidade: q, precoUnitarioBrlCentavos: precoUnit }],
        }),
      });
      if (!negRes.ok) throw new Error("neg");
      setTitulo("");
      setDescricao("");
      setDataHoraLocal("");
      setLeadId(null);
      setNomeNovoLead("");
      setWhatsappNovo("");
      setEmailNovo("");
      setProdutoId("");
      setCriarPacote(false);
      setNomePacote("");
      setPrecoPacoteReais("");
      setQuantidade(1);
      onCriada();
    } catch {
      alert("Confira WhatsApp (novo contato), pacote/preço e data do evento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void criar(e)}
      className="mb-2 space-y-3 rounded-xl border border-borda-sutil bg-fundo-profundo p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p id="titulo-nova-negociacao-modal" className="text-sm font-black text-texto-principal">
            Nova negociação
          </p>
          <p className="text-[11px] font-semibold text-slate-800">
            Etapa: <span className="font-black text-[#FF6B00]">{etiquetaEtapa}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-slate-600 hover:bg-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setModoLead("existente");
            setLeadId(null);
          }}
          className={`flex-1 rounded-lg py-1.5 ${modoLead === "existente" ? "bg-[#FF6B00] text-white" : "bg-white text-slate-800"}`}
        >
          Cliente existente
        </button>
        <button
          type="button"
          onClick={() => {
            setModoLead("novo");
            setLeadId(null);
          }}
          className={`flex-1 rounded-lg py-1.5 ${modoLead === "novo" ? "bg-[#FF6B00] text-white" : "bg-white text-slate-800"}`}
        >
          Novo contato
        </button>
      </div>

      {modoLead === "existente" ? (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-800">Buscar cliente</label>
          <div className="relative">
            <input
              className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 pr-8 text-sm"
              placeholder="Nome…"
              value={buscaLead}
              onChange={(e) => setBuscaLead(e.target.value)}
            />
            {buscandoLeads ? (
              <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-slate-400" />
            )}
          </div>
          <select
            className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
            value={leadId ?? ""}
            onChange={(e) => setLeadId(e.target.value || null)}
            required={modoLead === "existente"}
          >
            <option value="">Selecione o lead</option>
            {leadsOp.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nomeContato}
                {l.telefoneContato ? ` · ${l.telefoneContato}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
            placeholder="Nome do contato"
            value={nomeNovoLead}
            onChange={(e) => setNomeNovoLead(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
            placeholder="WhatsApp (obrigatório)"
            inputMode="tel"
            autoComplete="tel"
            value={whatsappNovo}
            onChange={(e) => setWhatsappNovo(e.target.value)}
            required
          />
          <input
            type="email"
            className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
            placeholder="E-mail (opcional)"
            value={emailNovo}
            onChange={(e) => setEmailNovo(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1 border-t border-borda-sutil pt-2">
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-800">
          <input
            type="checkbox"
            checked={criarPacote}
            onChange={(e) => {
              setCriarPacote(e.target.checked);
              if (e.target.checked) setProdutoId("");
            }}
          />
          Cadastrar pacote novo nesta hora
        </label>
        {criarPacote ? (
          <div className="grid gap-2">
            <input
              className="rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
              placeholder="Nome do pacote (catalogado)"
              value={nomePacote}
              onChange={(e) => setNomePacote(e.target.value)}
              required={criarPacote}
            />
            <input
              className="rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
              placeholder="Preço unitário de referência (R$)"
              value={precoPacoteReais}
              onChange={(e) => setPrecoPacoteReais(e.target.value)}
              required={criarPacote}
            />
          </div>
        ) : (
          <select
            className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            required={!criarPacote}
          >
            <option value="">Pacote do catálogo</option>
            {catalogo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          min={1}
          className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
        />
      </div>

      <input
        className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm font-semibold"
        placeholder="Título da negociação"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        required
      />
      <textarea
        className="w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
        rows={2}
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <div>
        <label className="text-[11px] font-bold text-slate-800">Data e hora do evento</label>
        <input
          type="datetime-local"
          className="mt-0.5 w-full rounded-lg border border-borda-sutil bg-white px-2 py-1.5 text-sm"
          value={dataHoraLocal}
          onChange={(e) => setDataHoraLocal(e.target.value)}
          required
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-borda-sutil pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-borda-sutil bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B00] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Criar
        </button>
      </div>
    </form>
  );
}
