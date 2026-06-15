"use client";

import { useEffect, useState } from "react";
import { Loader2, Percent, TrendingUp, Users, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FiltroRelatorio } from "../tiposFiltroRelatorio";
import { montarQueryFiltros } from "../montarQueryFiltros";
import { urlApiCrm } from "../urlApiCrm";
import { formatarMoedaCentavos, formatarVariacao } from "../formatacaoRelatorio";

type Comparativo = {
  valorAtual: number;
  valorAnterior: number;
  variacaoPercentual: number | null;
};

type ResumoDono = {
  contatosNoPeriodo: number;
  negociacoesAbertas: number;
  negociacoesGanhas: number;
  pipelineAtivoBrlCentavos: number;
  faturamentoBrutoBrlCentavos: number;
  taxaConversaoOrcamentoParaVenda: number;
  ticketMedioBrlCentavos: number;
  comparativoMesAnterior: {
    contatosNoPeriodo: Comparativo;
    negociacoesGanhas: Comparativo;
    negociacoesAbertas: Comparativo;
    faturamentoBrutoBrlCentavos: Comparativo;
    taxaConversaoOrcamentoParaVenda: Comparativo;
  };
};

type Props = { filtros: FiltroRelatorio };

function CartaoComparativo({
  titulo,
  valor,
  comp,
  Icone,
  destaque,
}: {
  titulo: string;
  valor: string;
  comp: Comparativo;
  Icone: typeof Wallet;
  destaque?: boolean;
}) {
  const delta = formatarVariacao(comp.variacaoPercentual);
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        destaque
          ? "border-[#FF6B00]/40 bg-gradient-to-br from-[#FF6B00]/10 to-white"
          : "border-borda-sutil bg-fundo-container"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-texto-secundario">{titulo}</p>
          <p className="mt-2 text-2xl font-black text-texto-principal">{valor}</p>
          <p
            className={`mt-1 text-xs font-semibold ${
              delta.positivo === true
                ? "text-emerald-600"
                : delta.positivo === false
                  ? "text-rose-600"
                  : "text-texto-secundario"
            }`}
          >
            vs mês anterior: {delta.texto}
          </p>
        </div>
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
            destaque ? "bg-[#FF6B00] text-white" : "bg-[#FF6B00]/15 text-[#FF6B00]"
          }`}
        >
          <Icone className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

export default function VisaoDono({ filtros }: Props) {
  const [resumo, setResumo] = useState<ResumoDono | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const r = await fetch(`${urlApiCrm()}/relatorios/resumo${montarQueryFiltros(filtros)}`);
        if (!r.ok) throw new Error();
        const dados = (await r.json()) as ResumoDono;
        if (ativo) setResumo(dados);
      } catch {
        if (ativo) {
          setResumo(null);
          setErro("Não foi possível carregar a visão do dono.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtros]);

  if (carregando) {
    return (
      <p className="flex items-center gap-2 py-12 text-sm text-texto-secundario">
        <Loader2 className="h-5 w-5 animate-spin text-[#FF6B00]" /> Carregando visão do dono…
      </p>
    );
  }

  if (erro || !resumo) {
    return (
      <p className="rounded-xl border border-dashed border-borda-media px-4 py-10 text-center text-sm text-texto-secundario">
        {erro ?? "Sem dados."}
      </p>
    );
  }

  const comp = resumo.comparativoMesAnterior;
  const graficoComparativo = [
    { nome: "Faturamento", atual: comp.faturamentoBrutoBrlCentavos.valorAtual / 100, anterior: comp.faturamentoBrutoBrlCentavos.valorAnterior / 100 },
    { nome: "Ganhas", atual: comp.negociacoesGanhas.valorAtual, anterior: comp.negociacoesGanhas.valorAnterior },
    { nome: "Abertas", atual: comp.negociacoesAbertas.valorAtual, anterior: comp.negociacoesAbertas.valorAnterior },
    { nome: "Contatos", atual: comp.contatosNoPeriodo.valorAtual, anterior: comp.contatosNoPeriodo.valorAnterior },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-secundario">
        KPIs do período com comparativo ao mês anterior — pipeline, conversão e faturamento.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoComparativo
          titulo="Faturamento ganho"
          valor={formatarMoedaCentavos(resumo.faturamentoBrutoBrlCentavos)}
          comp={comp.faturamentoBrutoBrlCentavos}
          Icone={Wallet}
          destaque
        />
        <CartaoComparativo
          titulo="Pipeline ativo"
          valor={formatarMoedaCentavos(resumo.pipelineAtivoBrlCentavos)}
          comp={comp.negociacoesAbertas}
          Icone={TrendingUp}
        />
        <CartaoComparativo
          titulo="Negociações ganhas"
          valor={String(resumo.negociacoesGanhas)}
          comp={comp.negociacoesGanhas}
          Icone={TrendingUp}
        />
        <CartaoComparativo
          titulo="Conversão orç. → venda"
          valor={`${resumo.taxaConversaoOrcamentoParaVenda}%`}
          comp={comp.taxaConversaoOrcamentoParaVenda}
          Icone={Percent}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm md:col-span-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-texto-secundario">Pipeline</h3>
          <p className="mt-2 text-3xl font-black text-[#FF6B00]">
            {formatarMoedaCentavos(resumo.pipelineAtivoBrlCentavos)}
          </p>
          <p className="mt-1 text-sm text-texto-secundario">
            {resumo.negociacoesAbertas} negociações abertas
          </p>
        </article>
        <article className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm md:col-span-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-texto-secundario">Conversão</h3>
          <p className="mt-2 text-3xl font-black text-texto-principal">
            {resumo.taxaConversaoOrcamentoParaVenda}%
          </p>
          <p className="mt-1 text-sm text-texto-secundario">Orçamentos que viraram venda</p>
        </article>
        <article className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm md:col-span-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-texto-secundario">Contatos</h3>
          <p className="mt-2 text-3xl font-black text-texto-principal">{resumo.contatosNoPeriodo}</p>
          <Users className="mt-2 h-5 w-5 text-[#FF6B00]" />
        </article>
      </div>

      <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
          Comparativo mês atual vs anterior
        </h3>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graficoComparativo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="atual" name="Atual" radius={[4, 4, 0, 0]}>
                {graficoComparativo.map((_, i) => (
                  <Cell key={`a-${i}`} fill="#FF6B00" />
                ))}
              </Bar>
              <Bar dataKey="anterior" name="Mês anterior" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
