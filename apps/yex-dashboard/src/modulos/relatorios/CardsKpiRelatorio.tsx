"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { DollarSign, Percent, TrendingUp, Users } from "lucide-react";
import type { FiltroRelatorio } from "./tiposFiltroRelatorio";
import { montarQueryFiltros } from "./montarQueryFiltros";
import { urlApiCrm } from "./urlApiCrm";

type ResumoApi = {
  contatosNoPeriodo?: number;
  contatosNoMes?: number;
  negociacoesAbertas: number;
  negociacoesGanhas: number;
  negociacoesPerdidas: number;
  orcamentosEnviados: number;
  taxaConversaoOrcamentoParaVenda: number;
  faturamentoBrutoBrlCentavos: number;
};

type Props = {
  filtros: FiltroRelatorio;
};

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CartaoKpi({
  titulo,
  valorExibido,
  dadosGrafico,
  Icone,
  destaque,
}: {
  titulo: string;
  valorExibido: string;
  dadosGrafico: number[];
  Icone: typeof DollarSign;
  destaque?: boolean;
}) {
  const chartData = dadosGrafico.map((v, i) => ({ v, i }));

  return (
    <article
      className={`rounded-2xl border p-4 shadow-cartao transition hover:shadow-cartaoHover sm:p-5 ${
        destaque
          ? "border-[#FF6B00]/40 bg-gradient-to-br from-[#FF6B00]/10 to-white"
          : "border-borda-sutil bg-fundo-container"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-texto-secundario">{titulo}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-texto-principal sm:text-3xl">
            {valorExibido}
          </p>
        </div>
        <div
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            destaque ? "bg-[#FF6B00] text-white" : "bg-[#FF6B00]/15 text-[#FF6B00]"
          }`}
        >
          <Icone className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <div className="mt-4 h-12 w-full opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="v" fill="#FF6B00" radius={[3, 3, 0, 0]} isAnimationActive />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export default function CardsKpiRelatorio({ filtros }: Props) {
  const [resumo, setResumo] = useState<ResumoApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const qs = montarQueryFiltros(filtros);
        const res = await fetch(`${urlApiCrm()}/relatorios/resumo${qs}`);
        if (!res.ok) throw new Error("resumo");
        const dados = (await res.json()) as ResumoApi;
        if (ativo) setResumo(dados);
      } catch {
        if (ativo) {
          setErro("Não foi possível carregar os KPIs.");
          setResumo(null);
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-borda-sutil bg-fundo-container"
          />
        ))}
      </div>
    );
  }

  if (erro || !resumo) {
    return (
      <p className="rounded-xl border border-dashed border-borda-media bg-fundo-container px-4 py-8 text-center text-sm text-texto-secundario">
        {erro ?? "Sem dados para o período."}
      </p>
    );
  }

  const kpis = [
    {
      titulo: "Valor ganho",
      valor: formatarMoeda(resumo.faturamentoBrutoBrlCentavos),
      serie: [
        resumo.negociacoesGanhas,
        Math.max(1, Math.round(resumo.faturamentoBrutoBrlCentavos / 100_000)),
        resumo.orcamentosEnviados,
      ],
      Icone: DollarSign,
      destaque: true,
    },
    {
      titulo: "Pipeline ativo",
      valor: String(resumo.negociacoesAbertas),
      serie: [resumo.negociacoesAbertas, resumo.negociacoesPerdidas, resumo.negociacoesGanhas],
      Icone: TrendingUp,
    },
    {
      titulo: "Contatos no período",
      valor: String(resumo.contatosNoPeriodo ?? resumo.contatosNoMes ?? 0),
      serie: [
        resumo.contatosNoPeriodo ?? resumo.contatosNoMes ?? 0,
        resumo.orcamentosEnviados,
        resumo.negociacoesGanhas,
      ],
      Icone: Users,
    },
    {
      titulo: "Conversão orçamento → venda",
      valor: `${resumo.taxaConversaoOrcamentoParaVenda}%`,
      serie: [
        resumo.taxaConversaoOrcamentoParaVenda,
        resumo.orcamentosEnviados,
        resumo.negociacoesGanhas,
      ],
      Icone: Percent,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <CartaoKpi
          key={k.titulo}
          titulo={k.titulo}
          valorExibido={k.valor}
          dadosGrafico={k.serie}
          Icone={k.Icone}
          destaque={k.destaque}
        />
      ))}
    </div>
  );
}
