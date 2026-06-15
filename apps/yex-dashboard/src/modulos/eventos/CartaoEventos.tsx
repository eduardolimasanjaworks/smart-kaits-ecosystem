// Card de eventos: faturamento, tickets e funil a partir da apresentação (qualificação).
"use client";

import type { BlocoEventos } from "@/dominio/contratos/tiposKpi";
import CartaoVidro from "@/modulos/compartilhado/CartaoVidro";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PropriedadesCartaoEventos = {
  bloco: BlocoEventos;
};

export default function CartaoEventos({ bloco }: PropriedadesCartaoEventos) {
  const [expandido, definirExpandido] = useState(false);

  const dadosGrafico = [
    { nome: "Apresentações", valor: bloco.funilApresentacoesFeitas },
    { nome: "Leads (Mês)", valor: bloco.funilLeadsMes },
    { nome: "Leads (Totais)", valor: bloco.funilLeadsTotais },
  ];

  return (
    <CartaoVidro titulo="Eventos">
      <div className="grid gap-3 md:grid-cols-2">
        <MetricaGrid titulo="Faturamento" valor={formatarMoeda(bloco.faturamento)} />
        <MetricaGrid titulo="Eventos vendidos" valor={String(bloco.quantidadeVendidos)} />
        <MetricaGrid
          titulo="Ticket médio / evento"
          valor={formatarMoeda(bloco.ticketMedioEvento)}
        />
        <MetricaGrid
          titulo="Ticket médio / pessoa"
          valor={formatarMoeda(bloco.ticketMedioPessoa)}
        />
        <div className="md:col-span-2 rounded-lg border border-borda-sutil bg-fundo-profundo p-3 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
              Funil (pós-apresentação)
            </p>
            <button
              type="button"
              onClick={() => definirExpandido(!expandido)}
              className="rounded-md border border-borda-sutil bg-fundo-container px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-texto-secundario shadow-sm hover:text-texto-principal"
            >
              {expandido ? "Ocultar Gráfico" : "Ver Gráfico Detalhado"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-b border-borda-sutil pb-4">
            <FunilItem rotulo="Apresentações" valor={bloco.funilApresentacoesFeitas} />
            <FunilItem rotulo="Leads no mês" valor={bloco.funilLeadsMes} />
            <FunilItem rotulo="Leads totais" valor={bloco.funilLeadsTotais} />
          </div>

          {expandido ? (
            <div className="mt-4 h-48 w-full animate-in fade-in slide-in-from-top-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 10 }} stroke="#E2E8F0" />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} stroke="#E2E8F0" />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.02)" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="valor" fill="#3B2E54" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      </div>
    </CartaoVidro>
  );
}

type PropriedadesMetricaGrid = {
  titulo: string;
  valor: string;
};

function MetricaGrid({ titulo, valor }: PropriedadesMetricaGrid) {
  return (
    <div className="rounded-lg border border-borda-sutil bg-fundo-profundo p-3">
      <p className="text-[11px] font-medium text-texto-secundario">{titulo}</p>
      <p className="mt-0.5 text-base font-semibold text-texto-principal">{valor}</p>
    </div>
  );
}

type PropriedadesFunilItem = { rotulo: string; valor: number };

function FunilItem({ rotulo, valor }: PropriedadesFunilItem) {
  return (
    <div>
      <p className="text-[11px] font-medium text-texto-secundario">{rotulo}</p>
      <p className="text-xl font-bold text-texto-principal">{valor}</p>
    </div>
  );
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
