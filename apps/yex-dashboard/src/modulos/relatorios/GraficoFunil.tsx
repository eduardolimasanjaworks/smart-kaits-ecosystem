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

type ColunaFunil = {
  colunaId: string;
  titulo: string;
  ordemPosicao: number;
  quantidade: number;
  valorEstimadoBrlCentavos: number;
  valorGanhoBrlCentavos: number;
};

type Props = { filtros: FiltroRelatorio; quadroId?: string };

export default function GraficoFunil({ filtros, quadroId }: Props) {
  const [dados, setDados] = useState<ColunaFunil[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const base = montarQueryFiltros({ ...filtros, quadroId: quadroId ?? filtros.quadroId });
        const sep = base.includes("?") ? "&" : "?";
        const q = quadroId && !filtros.quadroId ? `${base}${sep}quadroId=${quadroId}` : base;
        const r = await fetch(`${urlApiCrm()}/relatorios/funil${q}`);
        if (!r.ok) throw new Error();
        const j = (await r.json()) as { colunas?: ColunaFunil[] };
        if (ativo) {
          setDados(
            (j.colunas ?? []).sort((a, b) => a.ordemPosicao - b.ordemPosicao),
          );
        }
      } catch {
        if (ativo) {
          setDados([]);
          setErro("Funil indisponível. Confira se o endpoint /relatorios/funil está ativo.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtros, quadroId]);

  const serie = dados.map((c) => ({
    nome: c.titulo,
    qtd: c.quantidade,
    estimado: c.valorEstimadoBrlCentavos / 100,
    ganho: c.valorGanhoBrlCentavos / 100,
  }));

  return (
    <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
        Funil por coluna
      </h3>
      {carregando && (
        <p className="mt-4 flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando funil…
        </p>
      )}
      {erro && !carregando && <p className="mt-4 text-sm text-amber-700">{erro}</p>}
      {!carregando && !erro && serie.length === 0 && (
        <p className="mt-4 text-sm text-texto-secundario">Sem dados no período.</p>
      )}
      {serie.length > 0 && (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="nome"
                tick={{ fill: "#64748B", fontSize: 10 }}
                angle={-25}
                textAnchor="end"
                height={56}
              />
              <YAxis yAxisId="qtd" tick={{ fill: "#64748B", fontSize: 10 }} />
              <YAxis yAxisId="brl" orientation="right" tick={{ fill: "#64748B", fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, nome: string) =>
                  nome === "qtd" ? v : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                }
              />
              <Bar yAxisId="qtd" dataKey="qtd" fill="#86B9FF" name="Negociações" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="brl" dataKey="estimado" fill="#FF6B00" name="Estimado (R$)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
