"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2 } from "lucide-react";

type CartaoExpansivelProps = {
  id: string;
  titulo: string;
  valorDestaque: string;
  subtitulo?: string;
  icone: React.ReactNode;
  bgClass?: string;
  children: React.ReactNode;
};

export default function CartaoExpansivel({
  id,
  titulo,
  valorDestaque,
  subtitulo,
  icone,
  bgClass = "bg-white text-slate-900 border border-slate-200",
  children,
}: CartaoExpansivelProps) {
  const [expandido, setExpandido] = useState(false);

  // Áudio reativo instântaneo
  const tocarSomHover = useCallback(() => {
    try {
      const audio = new Audio("/sons/pop.mp3");
      audio.volume = 0.3;
      audio.playbackRate = 0.95 + Math.random() * 0.1;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  return (
    <>
      <motion.div
        layoutId={`expand-card-${id}`}
        onClick={() => setExpandido(true)}
        onMouseEnter={tocarSomHover}
        whileHover={{ scale: 1.05, y: -5 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={`group relative flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-sm hover:shadow-xl active:scale-95 ${bgClass}`}
      >
        <div className="flex items-start justify-between">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 text-current backdrop-blur-md">
            {icone}
          </div>
          <button className="opacity-0 transition-opacity group-hover:opacity-100 p-2 rounded-full hover:bg-black/10">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-bold tracking-tight opacity-90">{titulo}</h3>
          <p className="mt-1 text-3xl font-black tracking-tighter">{valorDestaque}</p>
          {subtitulo && <p className="mt-1 text-sm font-medium opacity-70">{subtitulo}</p>}
        </div>
      </motion.div>

      {/* Modal/Drill-down (Surface Level 2) */}
      <AnimatePresence>
        {expandido && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setExpandido(false)}
            />

            <motion.div
              layoutId={`expand-card-${id}`}
              className={`relative z-10 flex h-full max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] shadow-2xl ${
                bgClass.includes("bg-white") ? "bg-fundo-base text-texto-principal" : bgClass
              }`}
            >
              <div className="flex items-center justify-between border-b border-black/10 px-8 py-6 backdrop-blur-md bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/10 text-current backdrop-blur-md">
                    {icone}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
                    <p className="font-medium opacity-80 text-sm">
                      {subtitulo || "Visão Detalhada"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandido(false)}
                  className="rounded-full bg-black/10 p-3 transition-colors hover:bg-black/20"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-fundo-base text-texto-principal">
                {/* Aqui renderizamos o cartão original complexo (gráfico, tabelas, etc) */}
                {children}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
