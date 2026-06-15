"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GraficoFunil from "../GraficoFunil";
import type { FiltroRelatorio } from "../tiposFiltroRelatorio";
import { montarQueryFiltros } from "../montarQueryFiltros";
import { urlApiCrm } from "../urlApiCrm";

type LinhaTempo = {
  colunaId: string;
  titulo: string;
  ordemPosicao: number;
  mediaDias: number;
  medianaDias: number;
  amostras: number;
};

type Gargalo = {
  gargaloPrincipal: LinhaTempo | null;
  colunas: LinhaTempo[];
};

type Props = { filtros: FiltroRelatorio; quadroId?: string };

export default function VisaoFunil({ filtros, quadroId }: Props) {
  const [gargalos, setGargalos] = useState<Gargalo | null>(null);
  const [tempoColunas, setTempoColunas] = useState<LinhaTempo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const qs = montarQueryFiltros({ ...filtros, quadroId: quadroId ?? filtros.quadroId });
    void (async () => {
      try {
        const [rG, rT] = await Promise.all([
          fetch(`${urlApiCrm()}/relatorios/gargalos${qs}`),
          fetch(`${urlApiCrm()}/relatorios/tempo-por-coluna${qs}`),
        ]);
        if (!rG.ok || !rT.ok) throw new Error();
        const jG = (await rG.json()) as Gargalo;
        const jT = (await rT.json()) as { colunas?: LinhaTempo[] };
        if (ativo) {
          setGargalos(jG);
          setTempoColunas((jT.colunas ?? []).sort((a, b) => a.ordemPosicao - b.ordemPosicao));
        }
      } catch {
        if (ativo) {
          setGargalos(null);
          setTempoColunas([]);
          setErro("Métricas de funil indisponíveis.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtros, quadroId]);

  const serieTempo = tempoColunas.map((c) => ({
    nome: c.titulo,
    media: c.mediaDias,
    mediana: c.medianaDias,
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-secundario">
        Funil por coluna, gargalos (maior tempo médio) e permanência em cada etapa.
      </p>

      <GraficoFunil filtros={filtros} quadroId={quadroId} />

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-texto-secundario">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF6B00]" /> Analisando gargalos…
        </p>
      )}

      {erro && !carregando && <p className="text-sm text-amber-700">{erro}</p>}

      {gargalos?.gargaloPrincipal && !carregando && (
        <article className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF6B00] text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-900">Gargalo principal</h3>
            <p className="mt-1 text-lg font-bold text-texto-principal">
              {gargalos.gargaloPrincipal.titulo}
            </p>
            <p className="text-sm text-amber-800">
              Média de {gargalos.gargaloPrincipal.mediaDias} dias na coluna (
              {gargalos.gargaloPrincipal.amostras} movimentações)
            </p>
          </div>
        </article>
      )}

      {serieTempo.length > 0 && (
        <section className="rounded-2xl border border-borda-sutil bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#FF6B00]" />
            <h3 className="text-sm font-black uppercase tracking-widest text-texto-secundario">
              Tempo por coluna (dias)
            </h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieTempo} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fill: "#64748B", fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={100}
                  tick={{ fill: "#64748B", fontSize: 10 }}
                />
                <Tooltip formatter={(v: number) => `${v} dias`} />
                <Bar dataKey="media" name="Média" fill="#FF6B00" radius={[0, 4, 4, 0]} />
                <Bar dataKey="mediana" name="Mediana" fill="#86B9FF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
