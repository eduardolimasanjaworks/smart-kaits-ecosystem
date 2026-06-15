"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { KpisConsolidado } from "@/dominio/contratos/tiposKpi";
import {
  TrendingUp,
  CircleDot,
  UtensilsCrossed,
  CalendarDays,
  Bot,
  Play,
  Pause,
  SkipForward,
  SkipBack,
} from "lucide-react";

import {
  CartaoBolicheIndicadores,
  CartaoBolicheConsumoCruzado,
  CartaoBolicheRanking,
} from "@/modulos/boliche/CartaoBoliche";
import CartaoEventos from "@/modulos/eventos/CartaoEventos";
import CartaoFaturamentoGlobal from "@/modulos/faturamento-global/CartaoFaturamentoGlobal";
import CartaoAnoIndividual from "@/modulos/faturamento-global/CartaoAnoIndividual";
import {
  CartaoRestauranteSemana,
  CartaoRestauranteFimDeSemana,
} from "@/modulos/restaurante/CartaoRestaurante";
import CartaoIntencoesWhatsApp from "@/modulos/whatsapp-inteligencia/CartaoIntencoesWhatsApp";

const CATEGORIAS_TV = [
  {
    id: "faturamento",
    titulo: "Visão Global",
    icon: TrendingUp,
    bgClass: "bg-[#86B9FF] text-slate-900",
    render: (kpis: KpisConsolidado) => (
      <div className="grid grid-cols-2 gap-6 h-full">
        <div className="bg-white rounded-3xl p-6 shadow-xl flex flex-col">
          <CartaoFaturamentoGlobal bloco={kpis.faturamentoGlobal} />
        </div>
        <div className="grid grid-rows-2 gap-6">
          <div className="flex min-h-0 flex-col">
            <CartaoAnoIndividual
              titulo="2024"
              fatias={{ restaurante: 48, boliche: 32, eventos: 20 }}
            />
          </div>
          <div className="flex min-h-0 flex-col">
            <CartaoAnoIndividual
              titulo="2025"
              fatias={{ restaurante: 44, boliche: 36, eventos: 20 }}
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "restaurante",
    titulo: "Restaurante",
    icon: UtensilsCrossed,
    bgClass: "bg-[#FF6B00] text-white",
    render: (kpis: KpisConsolidado) => (
      <div className="grid grid-cols-2 gap-6 h-full">
        <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl">
          <CartaoRestauranteSemana bloco={kpis.restaurante} />
        </div>
        <div className="bg-[#111] text-white rounded-3xl p-6 shadow-xl">
          <CartaoRestauranteFimDeSemana bloco={kpis.restaurante} />
        </div>
      </div>
    ),
  },
  {
    id: "boliche",
    titulo: "Boliche",
    icon: CircleDot,
    bgClass: "bg-white text-slate-900 border border-slate-200",
    render: (kpis: KpisConsolidado) => (
      <div className="grid grid-cols-3 gap-6 h-full">
        <div className="bg-fundo-base rounded-3xl p-6 shadow-sm">
          <CartaoBolicheIndicadores bloco={kpis.boliche} />
        </div>
        <div className="bg-fundo-base rounded-3xl p-6 shadow-sm">
          <CartaoBolicheConsumoCruzado bloco={kpis.boliche} />
        </div>
        <div className="bg-fundo-base rounded-3xl p-6 shadow-sm">
          <CartaoBolicheRanking bloco={kpis.boliche} />
        </div>
      </div>
    ),
  },
  {
    id: "eventos",
    titulo: "Eventos & Corporativo",
    icon: CalendarDays,
    bgClass: "bg-[#111111] text-white",
    render: (kpis: KpisConsolidado) => (
      <div className="grid grid-cols-1 gap-6 h-full">
        <div className="bg-fundo-profundo text-texto-principal rounded-3xl p-6 shadow-xl">
          <CartaoEventos bloco={kpis.eventos} />
        </div>
      </div>
    ),
  },
  {
    id: "IA",
    titulo: "Inteligência Artificial",
    icon: Bot,
    bgClass: "bg-[#FFD100] text-slate-900",
    render: (kpis: KpisConsolidado) => (
      <div className="grid grid-cols-1 gap-6 h-full">
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <CartaoIntencoesWhatsApp bloco={kpis.whatsapp} />
        </div>
      </div>
    ),
  },
];

const INTERVALO_ROTACAO_TV_MS = 15000;

export default function PainelRotacaoTv({ kpis }: { kpis: KpisConsolidado }) {
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return;
    const temporizador = window.setInterval(() => {
      setIndiceAtivo((valor) => (valor + 1) % CATEGORIAS_TV.length);
    }, INTERVALO_ROTACAO_TV_MS);
    return () => window.clearInterval(temporizador);
  }, [pausado]);

  const slideAtual = CATEGORIAS_TV[indiceAtivo];
  const IconeAtual = slideAtual.icon;

  return (
    <div
      className={`relative min-h-dvh w-full overflow-hidden flex flex-col transition-colors duration-1000 ${slideAtual.bgClass}`}
    >
      {/* Background Decorativo Typography */}
      <div className="absolute -bottom-10 -right-10 text-[20rem] font-black opacity-[0.03] select-none pointer-events-none uppercase tracking-tighter mix-blend-overlay">
        {slideAtual.titulo.substring(0, 4)}
      </div>

      {/* Header do TV Mode */}
      <header className="relative z-10 flex items-center justify-between px-12 py-8">
        <div className="flex items-center gap-6">
          <motion.div
            key={`icon-${slideAtual.id}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="inline-flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-black/10 backdrop-blur-md"
          >
            <IconeAtual className="h-10 w-10" />
          </motion.div>
          <div>
            <p className="text-xl font-bold uppercase tracking-widest opacity-70">
              Clear Strike • TV
            </p>
            <motion.h1
              key={`title-${slideAtual.id}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-6xl font-black tracking-tighter"
            >
              {slideAtual.titulo}
            </motion.h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 px-12 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${slideAtual.id}`}
            initial={{ opacity: 0, x: 50, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -50, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="h-full w-full"
          >
            {slideAtual.render(kpis)}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* TV Footer Controls (Flutuante) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full bg-black/20 backdrop-blur-xl px-6 py-3 text-white border border-white/10 shadow-2xl">
        <button
          onClick={() =>
            setIndiceAtivo((i) => (i - 1 + CATEGORIAS_TV.length) % CATEGORIAS_TV.length)
          }
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          onClick={() => setPausado(!pausado)}
          className="p-3 hover:bg-white/10 rounded-full transition-colors bg-white/10"
        >
          {pausado ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
        </button>
        <button
          onClick={() => setIndiceAtivo((i) => (i + 1) % CATEGORIAS_TV.length)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <SkipForward className="h-5 w-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-2" />

        {/* Indicadores de Slide */}
        <div className="flex items-center gap-2">
          {CATEGORIAS_TV.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => setIndiceAtivo(i)}
              className={`h-2.5 rounded-full transition-all duration-500 ${i === indiceAtivo ? "w-8 bg-white" : "w-2.5 bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
