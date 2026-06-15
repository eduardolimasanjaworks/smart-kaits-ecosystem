"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Plus, QrCode, Trash2, Pencil, CheckCircle2, XCircle, Clock } from "lucide-react";
import mesclarClasses from "@/lib/utils/mesclarClasses";
import { urlApiCrm } from "@/lib/crm/urlApiCrm";

type CupomApi = {
  id: string;
  token: string;
  codigo: string;
  nome: string;
  motivo: string;
  descontoPercentual: number;
  validade: string;
  status?: string;
  queimadoEm: string | null;
  criadoEm: string;
};

function fimValidade(validade: string) {
  return new Date(`${validade}T23:59:59.999`);
}

function rotuloStatus(c: CupomApi): { texto: string; classe: string; Icone: typeof CheckCircle2 } {
  if (c.queimadoEm) {
    return { texto: "Utilizado", classe: "bg-slate-700 text-white", Icone: CheckCircle2 };
  }
  if (new Date() > fimValidade(c.validade)) {
    return { texto: "Expirado", classe: "bg-amber-600 text-white", Icone: XCircle };
  }
  return { texto: "Ativo", classe: "bg-emerald-600 text-white", Icone: Clock };
}

export default function GestorCuponsComercial() {
  const [cupons, setCupons] = useState<CupomApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [origem, setOrigem] = useState("");

  const [nome, setNome] = useState("");
  const [motivo, setMotivo] = useState("");
  const [desconto, setDesconto] = useState(10);
  const [validade, setValidade] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [motivoEdicao, setMotivoEdicao] = useState("");
  const [descontoEdicao, setDescontoEdicao] = useState(0);
  const [validadeEdicao, setValidadeEdicao] = useState("");

  const motivosAnteriores = useMemo(
    () => [...new Set(cupons.map((c) => c.motivo).filter(Boolean))],
    [cupons],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/cupons`);
      if (!res.ok) throw new Error("Falha ao listar cupons");
      const dados = (await res.json()) as { cupons: CupomApi[] };
      setCupons(dados.cupons ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    setOrigem(typeof window !== "undefined" ? window.location.origin : "");
    void carregar();
  }, [carregar]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/cupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          motivo: motivo || nome,
          descontoPercentual: desconto,
          validade,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { erro?: string };
        throw new Error(j.erro ?? "Não foi possível criar");
      }
      setNome("");
      setMotivo("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar");
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/cupons/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const iniciarEdicao = (c: CupomApi) => {
    setEditandoId(c.id);
    setNomeEdicao(c.nome);
    setMotivoEdicao(c.motivo ?? c.nome);
    setDescontoEdicao(c.descontoPercentual);
    setValidadeEdicao(c.validade);
  };

  const salvarEdicao = async (id: string) => {
    setErro(null);
    try {
      const res = await fetch(`${urlApiCrm()}/cupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeEdicao,
          motivo: motivoEdicao,
          descontoPercentual: descontoEdicao,
          validade: validadeEdicao,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const qrDataUrl = useMemo(() => {
    return (token: string) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${origem}/cupom/${token}`)}`;
  }, [origem]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-texto-principal">Gestor de cupons</h2>
          <p className="text-sm font-medium leading-relaxed text-slate-900">
            Código no formato L+N+L+N+especial+L+N+L. O link/QR consome o cupom ao confirmar o resgate.
          </p>
        </div>
        <Gift className="hidden h-10 w-10 text-acento-marca sm:block" aria-hidden />
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Nome / campanha
          </label>
          <input
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal outline-none ring-acento-marca/30 focus:ring-2"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Happy Hour Maio"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Motivo / detalhes
          </label>
          <input
            list="motivos-cupom"
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal outline-none ring-acento-marca/30 focus:ring-2"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Retenção cliente VIP"
            required
          />
          <datalist id="motivos-cupom">
            {motivosAnteriores.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Desconto %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal outline-none ring-acento-marca/30 focus:ring-2"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-texto-secundario">
            Válido até
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-borda-sutil bg-fundo-base px-4 py-2.5 text-sm text-texto-principal outline-none ring-acento-marca/30 focus:ring-2"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#E65F00] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Criar cupom
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-borda-sutil bg-white shadow-cartao ring-1 ring-black/[0.04]">
        <div className="flex items-center justify-between border-b border-borda-sutil px-6 py-4">
          <span className="text-sm font-bold uppercase tracking-widest text-slate-900">Cupons</span>
          <button
            type="button"
            onClick={() => void carregar()}
            className="text-xs font-semibold text-acento-marca hover:underline"
          >
            Atualizar
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-texto-secundario">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : cupons.length === 0 ? (
          <p className="py-16 text-center text-sm text-texto-secundario">Nenhum cupom ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-fundo-profundo text-xs uppercase font-semibold text-slate-900">
                <tr>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Código</th>
                  <th className="px-4 py-3 font-bold">Nome</th>
                  <th className="px-4 py-3 font-bold">%</th>
                  <th className="px-4 py-3 font-bold">Validade</th>
                  <th className="px-4 py-3 font-bold">QR</th>
                  <th className="px-4 py-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cupons.map((c) => {
                  const st = rotuloStatus(c);
                  const IconeSt = st.Icone;
                  const editando = editandoId === c.id;
                  return (
                    <tr key={c.id} className="border-t border-borda-sutil hover:bg-fundo-profundo/80">
                      <td className="px-4 py-3">
                        <span
                          className={mesclarClasses(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                            st.classe,
                          )}
                        >
                          <IconeSt className="h-3.5 w-3.5" />
                          {st.texto}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-acento-marca">
                        {c.codigo}
                      </td>
                      <td className="px-4 py-3 text-texto-principal">
                        {editando ? (
                          <input
                            className="w-full max-w-xs rounded-lg border border-borda-sutil bg-fundo-base px-2 py-1 text-sm"
                            value={nomeEdicao}
                            onChange={(e) => setNomeEdicao(e.target.value)}
                          />
                        ) : (
                          <span>
                            {c.nome}
                            <span className="mt-0.5 block text-xs text-texto-secundario">{c.motivo}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editando ? (
                          <input
                            type="number"
                            className="w-20 rounded-lg border border-borda-sutil bg-fundo-base px-2 py-1 text-sm"
                            value={descontoEdicao}
                            onChange={(e) => setDescontoEdicao(Number(e.target.value))}
                          />
                        ) : (
                          `${c.descontoPercentual}%`
                        )}
                      </td>
                      <td className="px-4 py-3 text-texto-secundario">
                        {editando ? (
                          <input
                            type="date"
                            className="rounded-lg border border-borda-sutil bg-fundo-base px-2 py-1 text-sm"
                            value={validadeEdicao}
                            onChange={(e) => setValidadeEdicao(e.target.value)}
                          />
                        ) : (
                          c.validade
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {origem ? (
                          <a
                            href={`${origem}/cupom/${c.token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-col items-start gap-1"
                            title="Abrir página de resgate"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- QR externo dinâmico */}
                            <img
                              src={qrDataUrl(c.token)}
                              alt=""
                              width={72}
                              height={72}
                              className="rounded-lg border border-borda-sutil bg-white p-1"
                            />
                            <span className="flex items-center gap-1 text-[10px] font-medium text-acento-marca">
                              <QrCode className="h-3 w-3" />
                              Link
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-texto-secundario">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {editando ? (
                            <button
                              type="button"
                              onClick={() => void salvarEdicao(c.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                            >
                              Salvar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(c)}
                              className="rounded-lg border border-borda-sutil p-2 text-texto-principal hover:bg-fundo-profundo"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {editando && (
                            <button
                              type="button"
                              onClick={() => setEditandoId(null)}
                              className="rounded-lg border border-borda-sutil px-2 py-1.5 text-xs font-semibold text-slate-800 hover:bg-fundo-profundo"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void excluir(c.id)}
                            className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
