"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GraficoFaturamentoMensal from "../GraficoFaturamentoMensal";
import type { FiltroRelatorio } from "../tiposFiltroRelatorio";
import { montarQueryFiltros } from "../montarQueryFiltros";
import { urlApiCrm } from "../urlApiCrm";
import { formatarMoedaCentavos } from "../formatacaoRelatorio";

type TopCliente = {
  leadId: string;
  nomeContato: string;
  totalFaturadoBrlCentavos: number;
  negociacoesGanhas: number;
};

type TopProduto = {
  produtoId: string;
  nome: string;
  quantidadeTotal: number;
  receitaBrlCentavos: number;
};

type TicketMedio = {
  ticketMedioBrlCentavos: number;
  negociacoesGanhas: number;
  faturamentoTotalBrlCentavos: number;
};

type Props = { filtros: FiltroRelatorio };

export default function VisaoFinanceiro({ filtros }: Props) {
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProduto[]>([]);
  const [ticket, setTicket] = useState<TicketMedio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const qs = montarQueryFiltros(filtros);
    void (async () => {
      try {
        const [rC, rP, rT] = await Promise.all([
          fetch(`${urlApiCrm()}/relatorios/top-clientes${qs}`),
          fetch(`${urlApiCrm()}/relatorios/top-produtos${qs}`),
          fetch(`${urlApiCrm()}/relatorios/ticket-medio${qs}`),
        ]);
        if (!rC.ok || !rP.ok || !rT.ok) throw new Error();
        const jC = (await rC.json()) as { clientes?: TopCliente[] };
        const jP = (await rP.json()) as { produtos?: TopProduto[] };
        const jT = (await rT.json()) as TicketMedio;
        if (ativo) {
          setTopClientes(jC.clientes ?? []);
          setTopProdutos(jP.produtos ?? []);
          setTicket(jT);
        }
      } catch {
        if (ativo) {
          setTopClientes([]);
          setTopProdutos([]);
          setTicket(null);
          setErro("Dados financeiros indisponíveis.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtros]);

  const serieClientes = topClientes.map((c) => ({
    nome: c.nomeContato.length > 14 ? `${c.nomeContato.slice(0, 14)}…` : c.nomeContato,
    valor: c.totalFaturadoBrlCentavos / 100,
  }));

  const serieProdutos = topProdutos.map((p) => ({
    nome: p.nome.length > 14 ? `${p.nome.slice(0, 14)}…` : p.nome,
    qtd: p.quantidadeTotal,
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-secundario">
        Faturamento mensal, ticket médio e rankings de clientes e produtos.
      </p>

      {ticket && (
        <article className="flex items-center gap-4 rounded-2xl border border-[#FF6B00]/40 bg-gradient-to-br from-[#FF6B00]/10 to-white p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF6B00] text-white">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-texto-secundario">
              Ticket médio
            </p>
            <p className="text-3xl font-black text-texto-principal">
              {formatarMoedaCentavos(ticket.ticketMedioBrlCentavos)}
            </p>
            <p className="text-sm text-texto-secundario">
              {ticket.negociacoesGanhas} vendas · total{" "}
              {formatarMoedaCentavos(ticket.faturamentoTotalBrlCentavos)}
            </p>
          </div>
        </article>
      )}

      <GraficoFaturamentoMensal filtros={filtros} />

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF6B00]" /> Carregando rankings…
        </p>
      )}
      {erro && !carregando && <p className="text-sm text-amber-700">{erro}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {serieClientes.length > 0 && (
          <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
              Top clientes
            </h3>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieClientes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) =>
                      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    }
                  />
                  <Bar dataKey="valor" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {serieProdutos.length > 0 && (
          <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
              Top produtos (qtd)
            </h3>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieProdutos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
