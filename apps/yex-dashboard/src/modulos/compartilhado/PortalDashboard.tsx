"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  LayoutGrid,
  Ticket,
  BarChart as IconeBarChart,
  BarChart3,
  Target,
  Filter,
  Users,
} from "lucide-react";
import type { PerfilUsuario } from "@/dominio/autenticacao/validarCredenciais";
import KanbanNegociacoesCrm from "@/modulos/crm/KanbanNegociacoesCrm";
import GestorCuponsComercial from "@/modulos/cupons/GestorCuponsComercial";
import GeradorRelatorios from "@/modulos/relatorios/GeradorRelatorios";
import MetasVendas from "@/modulos/metas/MetasVendas";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import GridMagnetico, { DashboardItem } from "./GridMagnetico";
import GestaoUsuariosPainel from "./GestaoUsuariosPainel";

/** `bgClass` já traz text-black ou text-white — aqui reforça contraste e remove dependência de opacidades. */
function classesTextoCardMenu(bgClass: string) {
  const fundoClaroCard =
    bgClass.includes("text-black") || bgClass.includes("text-slate-900");
  return {
    titulo: fundoClaroCard
      ? "text-slate-950"
      : "text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.72)]",
    subtitulo: fundoClaroCard ? "text-slate-800" : "text-white font-semibold",
    valor: fundoClaroCard
      ? "text-slate-950"
      : "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]",
    iconWrap: fundoClaroCard
      ? "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm"
      : "rounded-2xl border border-white/60 bg-neutral-950 text-white shadow-md",
    camadaTexto: fundoClaroCard ? "drop-shadow-sm" : "drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]",
  };
}

/** Módulos comerciais (sem fotos decorativas). Comercial: estes quatro. Admin: estes + painel + usuários. */
const CATEGORIAS_COMERCIAL_BASE = [
  {
    id: "negociacoes",
    titulo: "Gestão de negociações",
    subtitulo: "Funil e etapas",
    valor: "CRM",
    icon: LayoutGrid,
    bgClass: "bg-[#86B9FF] text-black",
    colSpan: "lg:col-span-1",
    sparkType: "line" as const,
    sparkData: [20, 35, 40, 55, 50, 65, 70],
  },
  {
    id: "cupons",
    titulo: "Gestor de cupons",
    subtitulo: "Criar, editar e resgatar",
    valor: "Promoções",
    icon: Ticket,
    bgClass: "bg-[#FF6B00] text-white",
    colSpan: "lg:col-span-1",
    sparkType: "bar" as const,
    sparkData: [5, 8, 12, 10, 15, 18, 22],
  },
  {
    id: "metas",
    titulo: "Metas de vendas",
    subtitulo: "Semanal e mensal",
    valor: "Objetivos",
    icon: Target,
    bgClass: "bg-[#111111] text-white",
    colSpan: "lg:col-span-1",
    sparkType: "line" as const,
    sparkData: [40, 55, 50, 70, 65, 80, 90],
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    subtitulo: "KPIs e filtros comerciais",
    valor: "BI",
    icon: IconeBarChart,
    bgClass: "bg-slate-100 text-slate-900 ring-1 ring-slate-200",
    colSpan: "lg:col-span-1",
    sparkType: "bar" as const,
    sparkData: [12, 18, 22, 28, 24, 32, 38],
  },
] as const;

const CATEGORIAS_ADMIN_EXTRAS = [
  {
    id: "visao-unificada",
    titulo: "Painel unificado",
    subtitulo: "Todos os indicadores",
    valor: "360°",
    icon: BarChart3,
    bgClass: "bg-zinc-900 text-white",
    colSpan: "lg:col-span-1",
    sparkType: "line" as const,
    sparkData: [30, 45, 42, 60, 58, 72, 80],
  },
  {
    id: "usuarios",
    titulo: "Usuários",
    subtitulo: "Logins e senhas (sem e-mail)",
    valor: "Equipe",
    icon: Users,
    bgClass: "bg-emerald-800 text-white",
    colSpan: "lg:col-span-1",
    sparkType: "line" as const,
    sparkData: [10, 22, 18, 30, 28, 35, 40],
  },
] as const;

const CATEGORIAS_ADMIN_COMPLETO = [...CATEGORIAS_COMERCIAL_BASE, ...CATEGORIAS_ADMIN_EXTRAS];

const CATEGORIAS_OPERACAO: (typeof CATEGORIAS_COMERCIAL_BASE)[number][] = [];

/** Ordem dos chips no painel unificado (alinhada ao tag `categoria` de cada cartão). */
const ORDEM_TEMAS_DASHBOARD = ["faturamento", "restaurante", "boliche", "eventos", "IA"] as const;

const ROTULO_TEMA_DASHBOARD: Record<string, string> = {
  faturamento: "Visão global",
  restaurante: "Restaurante",
  boliche: "Boliche",
  eventos: "Eventos",
  IA: "Voz & IA",
};

type PortalDashboardProps = {
  itemsDashboard: DashboardItem[];
  perfil?: PerfilUsuario;
};

export default function PortalDashboard({
  itemsDashboard,
  perfil = "admin",
}: PortalDashboardProps) {
  const categorias = useMemo(() => {
    if (perfil === "comercial") return [...CATEGORIAS_COMERCIAL_BASE];
    if (perfil === "operacao") return [...CATEGORIAS_OPERACAO];
    return [...CATEGORIAS_ADMIN_COMPLETO];
  }, [perfil]);
  const [tela, setTela] = useState<"menu" | "mergulhando" | "dashboard">("menu");
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [cardHovered, setCardHovered] = useState<string | null>(null);
  /** `null` = todos os temas (painel unificado). */
  const [filtroTemaUnificado, setFiltroTemaUnificado] = useState<string | null>(null);

  const temasNoPainel = useMemo(() => {
    const presentes = new Set(itemsDashboard.map((i) => i.categoria));
    const ordenados = ORDEM_TEMAS_DASHBOARD.filter((id) => presentes.has(id));
    const foraDaOrdem = [...presentes].filter((id) => !ORDEM_TEMAS_DASHBOARD.includes(id as (typeof ORDEM_TEMAS_DASHBOARD)[number]));
    foraDaOrdem.sort();
    return [...ordenados, ...foraDaOrdem];
  }, [itemsDashboard]);

  const itensPainelUnificado = useMemo(() => {
    if (filtroTemaUnificado === null) return itemsDashboard;
    return itemsDashboard.filter((i) => i.categoria === filtroTemaUnificado);
  }, [itemsDashboard, filtroTemaUnificado]);

  useEffect(() => {
    if (departamento !== "visao-unificada") setFiltroTemaUnificado(null);
  }, [departamento]);

  // Estado dinâmico dos gráficos (para mutação)
  const [dadosGraficos, setDadosGraficos] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setDadosGraficos((prev) => {
      const next = { ...prev };
      categorias.forEach((cat) => {
        if (!next[cat.id]) next[cat.id] = [...cat.sparkData];
      });
      const ids = new Set<string>(categorias.map((c) => c.id));
      Object.keys(next).forEach((k) => {
        if (!ids.has(k)) delete next[k];
      });
      return next;
    });
  }, [categorias]);

  // Motor de mutação de dados: Faz o gráfico "dançar" (Equalizador/Live Ticker) quando hoverado
  useEffect(() => {
    if (!cardHovered) return;
    const interval = setInterval(() => {
      setDadosGraficos((prev) => {
        const novos = { ...prev };
        // Aplica uma variação DRASTICA e caótica em TODOS os pontos do gráfico
        novos[cardHovered] = novos[cardHovered].map(() => {
          return Math.floor(Math.random() * 95) + 5; // Valores malucos entre 5 e 100
        });
        return novos;
      });
    }, 300); // 300ms para bater muito mais rápido (ritmo de bolsa de valores caótica)

    return () => clearInterval(interval);
  }, [cardHovered]);

  const handleMergulho = (id: string) => {
    setDepartamento(id);
    setTela("mergulhando");
  };

  const handleVoltar = () => {
    setTela("menu");
    // Limpamos o departamento após a animação de saída se desejado,
    // mas deixar ele setado ajuda o framer-motion a saber pra onde voltar o layoutId.
  };

  const catAtiva = categorias.find((c) => c.id === departamento);

  // Escuta tecla ESC para voltar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tela === "dashboard") handleVoltar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tela]);

  // Áudio reativo instântaneo pré-carregado na memória para evitar qualquer delay
  const tocarSomHover = useCallback(() => {
    // Verificamos se estamos no navegador
    if (typeof window === "undefined") return;

    try {
      const audio = new Audio("/sons/pop.mp3");
      audio.volume = 0.3;
      audio.playbackRate = 0.95 + Math.random() * 0.1;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // O navegador bloqueou o áudio por falta de interação inicial
          // Isso é normal. O som passará a funcionar após o primeiro clique do usuário.
        });
      }
    } catch (e) {
      // Ignora erros silenciosamente
    }
  }, []);

  // "Desbloqueador" de áudio para navegadores (Safari/Chrome/Edge)
  useEffect(() => {
    const desbloquearAudio = () => {
      tocarSomHover(); // Toca um som (que será bloqueado mas conta como interação)
      window.removeEventListener("click", desbloquearAudio);
    };
    window.addEventListener("click", desbloquearAudio);
    return () => window.removeEventListener("click", desbloquearAudio);
  }, [tocarSomHover]);

  return (
    <div className="relative min-h-[calc(100vh-68px)] w-full overflow-y-auto bg-transparent [scrollbar-gutter:stable]">
      <AnimatePresence mode="wait">
        {tela !== "dashboard" && (
          <motion.div
            key="menu-surface"
            className="absolute inset-0 p-6 sm:p-12"
            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)", transition: { duration: 0.4 } }}
          >
            <div className="flex min-h-full w-full items-center justify-center">
              <motion.div
                className={`grid h-auto lg:h-full min-h-[600px] w-full max-w-[1400px] grid-cols-1 gap-6 py-10 lg:py-0 pb-32 sm:pb-20 ${
                  perfil === "operacao"
                    ? "sm:grid-cols-1 lg:grid-cols-1"
                    : "sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {perfil === "operacao" && categorias.length === 0 && (
                  <div className="col-span-full flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] border border-borda-sutil bg-white p-12 text-center shadow-cartao">
                    <p className="text-2xl font-black text-texto-principal">Operação</p>
                    <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-800">
                      Menu em construção. Módulos operacionais serão adicionados neste perfil.
                    </p>
                  </div>
                )}
                {categorias.map((cat) => {
                  const Icone = cat.icon;
                  const isEscondido = tela === "mergulhando" && departamento === cat.id;
                  const texto = classesTextoCardMenu(cat.bgClass);

                  return (
                    <motion.div
                      key={cat.id}
                      layoutId={`portal-card-${cat.id}`}
                      onClick={() => tela === "menu" && handleMergulho(cat.id)}
                      onMouseEnter={() => {
                        setCardHovered(cat.id);
                        tocarSomHover();
                      }}
                      onMouseLeave={() => setCardHovered(null)}
                      whileHover={{
                        scale: 1.03,
                        y: -10,
                        rotateZ: isEscondido ? 0 : Math.random() > 0.5 ? 1 : -1,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`group relative cursor-pointer rounded-[3.5rem] p-8 shadow-lg hover:shadow-2xl active:scale-95 ${cat.bgClass} ${cat.colSpan} ${isEscondido ? "opacity-0" : "opacity-100"}`}
                    >
                      {/* Conteúdo Textual */}
                      <div
                        className={`relative z-30 flex h-full flex-col justify-between pointer-events-none ${texto.camadaTexto}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h2
                              className={`text-3xl font-black tracking-tight sm:text-4xl ${texto.titulo}`}
                            >
                              {cat.titulo}
                            </h2>
                            <div
                              className={`inline-flex h-12 w-12 items-center justify-center ${texto.iconWrap}`}
                            >
                              <Icone className="h-6 w-6" />
                            </div>
                          </div>
                          <p className={`mt-2 text-sm font-bold sm:text-base ${texto.subtitulo}`}>
                            {cat.subtitulo}
                          </p>
                        </div>

                        <div className="mt-auto flex flex-col gap-3 pt-8">
                          <p
                            className={`text-4xl font-extrabold tracking-tighter sm:text-5xl ${texto.valor}`}
                          >
                            {cat.valor}
                          </p>
                          {/* Mini Sparkline Chart para dar um tom mais 'Business Intelligence' */}
                          <div className="h-10 w-32 text-current opacity-90 transition-all duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2 sm:w-40">
                            <ResponsiveContainer width="100%" height="100%">
                              {cat.sparkType === "line" ? (
                                <LineChart
                                  data={(dadosGraficos[cat.id] ?? [...cat.sparkData]).map((v, i) => ({
                                    v,
                                    i,
                                  }))}
                                >
                                  <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                    dot={false}
                                    isAnimationActive={true}
                                    animationDuration={300}
                                  />
                                </LineChart>
                              ) : (
                                <BarChart
                                  data={(dadosGraficos[cat.id] ?? [...cat.sparkData]).map((v, i) => ({
                                    v,
                                    i,
                                  }))}
                                >
                                  <Bar
                                    dataKey="v"
                                    fill="currentColor"
                                    radius={[2, 2, 0, 0]}
                                    isAnimationActive={true}
                                    animationDuration={300}
                                  />
                                </BarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camada de Mergulho (Fullscreen Transition) */}
      <AnimatePresence>
        {tela === "mergulhando" && catAtiva && (
          <motion.div
            layoutId={`portal-card-${catAtiva.id}`}
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${catAtiva.bgClass}`}
            initial={{ borderRadius: "3.5rem" }}
            animate={{ borderRadius: "0px" }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            onAnimationComplete={() => setTela("dashboard")}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-4 px-8 text-center"
            >
              <catAtiva.icon
                className={`h-24 w-24 animate-pulse ${classesTextoCardMenu(catAtiva.bgClass).titulo}`}
              />
              <h1
                className={`text-5xl font-black tracking-tighter sm:text-6xl ${classesTextoCardMenu(catAtiva.bgClass).titulo}`}
              >
                {catAtiva.titulo}
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Surface Level 1 (Dashboard Interno) */}
      <AnimatePresence>
        {tela === "dashboard" && (
          <motion.div
            key="dashboard-surface"
            className="absolute inset-0 z-40 h-full w-full overflow-y-auto bg-fundo-base [scrollbar-gutter:stable]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.4 }}
          >
            {/* Cabeçalho/Rodapé Responsivo: Topo no Desktop, Rodapé no Mobile */}
            <div
              className="sticky bottom-0 order-last z-50 flex w-full items-center justify-between border-b border-t border-borda-sutil bg-white px-6 py-4 text-texto-principal shadow-sm lg:top-0 lg:order-none lg:border-t-0"
            >
              <button
                type="button"
                onClick={handleVoltar}
                className="group flex items-center gap-2 rounded-xl border border-borda-sutil bg-fundo-profundo px-4 py-2 text-sm font-bold text-texto-principal transition-colors hover:bg-slate-200 active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span className="inline lg:inline">Menu</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase tracking-widest text-slate-900">
                  {catAtiva?.titulo}
                </span>
              </div>
            </div>

            <div className="min-h-full pb-20">
              {departamento === "negociacoes" && <KanbanNegociacoesCrm />}
              {departamento === "cupons" && <GestorCuponsComercial />}
              {departamento === "metas" && <MetasVendas />}
              {departamento === "visao-unificada" && perfil === "admin" && (
                <div className="space-y-0">
                  <div className="border-b border-borda-sutil bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm lg:px-6">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Filter className="h-4 w-4 shrink-0 text-[#FF6B00]" aria-hidden />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Tema
                        </span>
                        {filtroTemaUnificado !== null && (
                          <span className="text-[11px] font-semibold text-slate-600">
                            ({itensPainelUnificado.length} de {itemsDashboard.length} cartões)
                          </span>
                        )}
                      </div>
                      <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="Filtrar cartões por tema"
                      >
                        <button
                          type="button"
                          onClick={() => setFiltroTemaUnificado(null)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            filtroTemaUnificado === null
                              ? "border-[#FF6B00] bg-[#FF6B00] text-white shadow-md"
                              : "border-borda-sutil bg-fundo-profundo text-slate-800 hover:border-[#FF6B00]/40"
                          }`}
                        >
                          Todos
                        </button>
                        {temasNoPainel.map((idTema) => (
                          <button
                            key={idTema}
                            type="button"
                            onClick={() => setFiltroTemaUnificado(idTema)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              filtroTemaUnificado === idTema
                                ? "border-[#FF6B00] bg-[#FF6B00] text-white shadow-md"
                                : "border-borda-sutil bg-white text-slate-800 hover:border-[#FF6B00]/40"
                            }`}
                          >
                            {ROTULO_TEMA_DASHBOARD[idTema] ?? idTema}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <GridMagnetico items={itensPainelUnificado} />
                </div>
              )}
              {departamento === "relatorios" && <GeradorRelatorios />}
              {departamento === "usuarios" && perfil === "admin" && <GestaoUsuariosPainel />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
