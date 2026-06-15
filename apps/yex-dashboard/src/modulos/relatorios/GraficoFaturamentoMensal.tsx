"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FiltroRelatorio } from "./tiposFiltroRelatorio";
import { montarQueryFiltros } from "./montarQueryFiltros";
import { urlApiCrm } from "./urlApiCrm";

type MesFaturamento = { mes: string; valorFechadoBrlCentavos: number };

type Props = { filtros: FiltroRelatorio };

function rotuloMes(mes: string) {
  const [y, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${y?.slice(2) ?? ""}`;
}

export default function GraficoFaturamentoMensal({ filtros }: Props) {
  const [meses, setMeses] = useState<MesFaturamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const r = await fetch(
          `${urlApiCrm()}/relatorios/faturamento-mensal${montarQueryFiltros(filtros)}`,
        );
        if (!r.ok) throw new Error();
        const j = (await r.json()) as { meses?: MesFaturamento[] };
        if (ativo) setMeses(j.meses ?? []);
      } catch {
        if (ativo) {
          setMeses([]);
          setErro("Faturamento mensal indisponível. Verifique /relatorios/faturamento-mensal.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtros]);

  const serie = meses.map((m) => ({
    nome: rotuloMes(m.mes),
    valor: m.valorFechadoBrlCentavos / 100,
  }));

  return (
    <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
        Faturamento mensal (ganhas)
      </h3>
      {carregando && (
        <p className="mt-4 flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando faturamento…
        </p>
      )}
      {erro && !carregando && <p className="mt-4 text-sm text-amber-700">{erro}</p>}
      {!carregando && !erro && serie.length === 0 && (
        <p className="mt-4 text-sm text-texto-secundario">Sem faturamento no período.</p>
      )}
      {serie.length > 0 && (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) =>
                  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                }
              />
              <Bar dataKey="valor" fill="#FF6B00" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
