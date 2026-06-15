"use client";
import React, { useState, useEffect, useRef } from "react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { LayoutDashboard, RefreshCcw, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Responsive, WidthProvider } from "react-grid-layout/legacy";

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLS_GRID = 12;
const CARDS_POR_LINHA = 3;
const LARGURA_CARD = COLS_GRID / CARDS_POR_LINHA; // 4 colunas cada (3 × 4 = 12)

export type DashboardItem = {
  id: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  component: React.ReactNode;
  categoria: string;
};

function montarLayoutTresPorLinha(items: DashboardItem[]) {
  const layout: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW: number;
    minH: number;
  }[] = [];
  let y = 0;
  for (let i = 0; i < items.length; i += CARDS_POR_LINHA) {
    const linha = items.slice(i, i + CARDS_POR_LINHA);
    const alturaLinha = Math.max(...linha.map((it) => it.defaultH));
    linha.forEach((item, j) => {
      layout.push({
        i: item.id,
        x: j * LARGURA_CARD,
        y,
        w: LARGURA_CARD,
        h: item.defaultH,
        minW: Math.min(item.minW ?? 2, LARGURA_CARD),
        minH: item.minH ?? 1,
      });
    });
    y += alturaLinha;
  }
  return layout;
}

type GridMagneticoProps = {
  items: DashboardItem[];
};

function chaveLayoutItens(items: DashboardItem[]) {
  return items.map((i) => `${i.id}:${i.defaultW}:${i.defaultH}`).join("|");
}

export default function GridMagnetico({ items }: GridMagneticoProps) {
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const itensVisiveis = items;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [layouts, setLayouts] = useState<any>(() => ({ lg: montarLayoutTresPorLinha(items) }));

  /** Evita resetar o layout a cada re-render do pai (nova referência de `items`); isso brigava com `onLayoutChange`/compactação e alternava a altura do container. */
  const ultimaChaveLayoutRef = useRef<string>("");
  useEffect(() => {
    const k = chaveLayoutItens(items);
    if (ultimaChaveLayoutRef.current === k) return;
    ultimaChaveLayoutRef.current = k;
    setLayouts({ lg: montarLayoutTresPorLinha(items) });
  }, [items]);

  const organizarTudo = () => {
    setLayouts({ lg: montarLayoutTresPorLinha(itensVisiveis) });
  };

  const fullscreenItem = items.find((i) => i.id === fullscreenId);

  return (
    <div className="mx-auto w-full max-w-[1920px] px-6 py-6">
      <div className="mb-2 flex justify-end">
        <button
          onClick={organizarTudo}
          className="flex items-center gap-2 rounded-full bg-slate-900/10 px-3 py-1.5 text-xs font-bold text-slate-900 transition-all hover:bg-slate-900 hover:text-white active:scale-95 dark:bg-white/10 dark:text-white dark:hover:bg-white dark:hover:text-black"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Organizar Grade
        </button>
      </div>

      <div className="cinematic-enter delay-3 [&_.react-grid-layout]:transition-none">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={(_currentLayout, allLayouts) => setLayouts(allLayouts)}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: COLS_GRID, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={160}
          containerPadding={[0, 0]}
          margin={[20, 20]}
          isDraggable={true}
          isResizable={true}
          resizeHandles={["s", "w", "e", "n", "sw", "nw", "se", "ne"]}
          compactType="vertical"
          useCSSTransforms={true}
          draggableHandle=".drag-handle"
        >
          {itensVisiveis.map((item) => (
            <div
              key={item.id}
              className="group relative h-full w-full overflow-hidden rounded-2xl border border-borda-sutil bg-white shadow-cartao ring-1 ring-black/5"
            >
              <div className="absolute right-4 top-4 z-50 flex items-center gap-2 transition-opacity">
                <button
                  onClick={() => setFullscreenId(item.id)}
                  className="rounded border border-borda-sutil bg-[#FF6B00] p-2 text-white shadow-md transition-all hover:bg-[#E65F00] active:scale-90"
                  title="Expandir"
                  type="button"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <div
                  className="drag-handle cursor-grab rounded border border-borda-sutil bg-[#FF6B00] p-2 text-white shadow-md transition-all hover:bg-[#E65F00] active:cursor-grabbing active:scale-90"
                  style={{ touchAction: "none" }}
                  title="Mover"
                >
                  <LayoutDashboard className="h-4 w-4" />
                </div>
              </div>

              <div className="h-full w-full overflow-hidden bg-white">{item.component}</div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      <AnimatePresence>
        {fullscreenItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/75 p-4 sm:p-8"
          >
            <div className="relative flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-borda-sutil bg-white shadow-2xl lg:h-full lg:overflow-hidden">
              <div className="flex items-center justify-between border-b border-borda-sutil bg-fundo-profundo px-6 py-4">
                <div className="flex items-center gap-3">
                  <Maximize2 className="h-5 w-5 text-acento-marca" />
                  <h2 className="text-lg font-bold text-texto-principal">
                    Visão expandida · {fullscreenItem.categoria}
                  </h2>
                </div>
                <button
                  onClick={() => setFullscreenId(null)}
                  className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-red-600"
                  type="button"
                >
                  <Minimize2 className="h-4 w-4" />
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-white p-4 sm:p-8 [&_.recharts-responsive-container]:min-h-[300px]">
                {fullscreenItem.component}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
