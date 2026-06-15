"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  Crown,
  Filter,
  Layers,
  SlidersHorizontal,
  TrendingUp,
  UserCircle,
  Wallet,
} from "lucide-react";
import FiltrosRelatorio from "./FiltrosRelatorio";
import CardsKpiRelatorio from "./CardsKpiRelatorio";
import GraficoFunil from "./GraficoFunil";
import GraficoFaturamentoMensal from "./GraficoFaturamentoMensal";
import TabelaNegociacoes from "./TabelaNegociacoes";
import VisaoDono from "./visoes/VisaoDono";
import VisaoCliente from "./visoes/VisaoCliente";
import VisaoFunil from "./visoes/VisaoFunil";
import VisaoFinanceiro from "./visoes/VisaoFinanceiro";
import {
  filtrosPadrao,
  periodoMesAtual,
  type FiltroRelatorio,
} from "./tiposFiltroRelatorio";
import { urlApiCrm } from "./urlApiCrm";

type VisaoId = "dono" | "cliente" | "funil" | "financeiro" | "personalizado";

const VISOES: { id: VisaoId; rotulo: string; descricao: string; Icone: typeof Crown }[] = [
  { id: "dono", rotulo: "Visão do dono", descricao: "KPIs e comparativo mensal", Icone: Crown },
  { id: "cliente", rotulo: "Por cliente", descricao: "Detalhe e PDF", Icone: UserCircle },
  { id: "funil", rotulo: "Funil", descricao: "Gargalos e tempo por coluna", Icone: Layers },
  { id: "financeiro", rotulo: "Financeiro", descricao: "Faturamento e rankings", Icone: Wallet },
  {
    id: "personalizado",
    rotulo: "Filtros livres",
    descricao: "Monte seu relatório",
    Icone: SlidersHorizontal,
  },
];

export default function GeradorRelatorios() {
  const [visao, setVisao] = useState<VisaoId>("dono");
  const [filtros, setFiltros] = useState<FiltroRelatorio>(filtrosPadrao);
  const [quadroId, setQuadroId] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${urlApiCrm()}/quadros/padrao`);
        if (!r.ok) return;
        const d = (await r.json()) as { quadro?: { id: string } };
        if (d.quadro?.id) setQuadroId(d.quadro.id);
      } catch {
        /* quadro opcional */
      }
    })();
  }, []);

  const aplicarEsteMes = useCallback(() => {
    setFiltros((f) => ({ ...f, ...periodoMesAtual(), resultados: undefined }));
  }, []);

  const aplicarSoGanhas = useCallback(() => {
    setFiltros((f) => ({ ...f, resultados: ["GANHA"] }));
  }, []);

  const aplicarPipelineAtivo = useCallback(() => {
    setFiltros((f) => ({ ...f, resultados: ["ABERTA"] }));
  }, []);

  const mostrarFiltrosPeriodo = visao !== "cliente";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {VISOES.map(({ id, rotulo, descricao, Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setVisao(id)}
              className={`flex min-w-[140px] flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full ${
                visao === id
                  ? "border-[#FF6B00] bg-[#FF6B00]/15 shadow-md"
                  : "border-borda-sutil bg-white hover:bg-fundo-profundo"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-texto-principal">
                <Icone className={`h-4 w-4 ${visao === id ? "text-[#FF6B00]" : ""}`} />
                {rotulo}
              </span>
              <span className="text-xs font-semibold leading-snug text-slate-800">{descricao}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-texto-principal">
              <BarChart3 className="h-7 w-7 text-[#FF6B00]" />
              Relatórios comerciais
            </h1>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-900">
              Respostas para dono e equipe — visões prontas ou filtros personalizados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={aplicarEsteMes}
              className="inline-flex items-center gap-1.5 rounded-full border border-borda-sutil bg-white px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-fundo-container"
            >
              <Calendar className="h-3.5 w-3.5" />
              Este mês
            </button>
            <button
              type="button"
              onClick={aplicarSoGanhas}
              className="inline-flex items-center gap-1.5 rounded-full border border-borda-sutil bg-white px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-fundo-container"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Só ganhas
            </button>
            <button
              type="button"
              onClick={aplicarPipelineAtivo}
              className="inline-flex items-center gap-1.5 rounded-full border border-borda-sutil bg-white px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-fundo-container"
            >
              <Filter className="h-3.5 w-3.5" />
              Pipeline ativo
            </button>
          </div>
        </header>

        {mostrarFiltrosPeriodo && <FiltrosRelatorio valor={filtros} onChange={setFiltros} />}

        {visao === "dono" && <VisaoDono filtros={filtros} />}
        {visao === "cliente" && <VisaoCliente filtros={filtros} />}
        {visao === "funil" && <VisaoFunil filtros={filtros} quadroId={quadroId} />}
        {visao === "financeiro" && <VisaoFinanceiro filtros={filtros} />}

        {visao === "personalizado" && (
          <>
            <CardsKpiRelatorio filtros={filtros} />
            <div className="grid gap-6 lg:grid-cols-2">
              <GraficoFunil filtros={filtros} quadroId={quadroId} />
              <GraficoFaturamentoMensal filtros={filtros} />
            </div>
            <TabelaNegociacoes filtros={filtros} />
          </>
        )}
      </main>
    </div>
  );
}
