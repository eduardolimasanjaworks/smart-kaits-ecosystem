"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronRight, ShieldCheck } from "lucide-react";

type SliderCaptchaProps = {
  onSuccess: () => void;
};

export default function SliderCaptcha({ onSuccess }: SliderCaptchaProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  // O slider tem 320px de largura total (w-80 aprox) e o botão tem 56px (h-14)
  // Calculamos a largura do track para o arraste
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setTrackWidth(containerRef.current.offsetWidth - 64); // 64 = largura do botão + margens
    }
  }, []);

  const opacity = useTransform(x, [0, trackWidth], [1, 0]);
  const scale = useTransform(x, [0, trackWidth], [1, 1.1]);

  const handleDragEnd = () => {
    if (x.get() > trackWidth * 0.9) {
      setIsSuccess(true);
      onSuccess();
    } else {
      x.set(0);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
        Verificação de Segurança
      </p>

      <div
        ref={containerRef}
        className="relative h-14 w-full rounded-2xl bg-black/40 border border-white/5 overflow-hidden backdrop-blur-sm"
      >
        {/* Texto de Fundo */}
        <motion.div
          style={{ opacity }}
          className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/20 select-none"
        >
          Arraste para confirmar
        </motion.div>

        {/* Barra de Progresso Laranja */}
        <motion.div
          style={{ width: x }}
          className="absolute inset-y-0 left-0 bg-[#FF6B00]/20 pointer-events-none"
        />

        {/* Botão de Arraste (Handle) */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: trackWidth }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={`absolute left-1 top-1 h-12 w-12 flex items-center justify-center rounded-xl cursor-grab active:cursor-grabbing shadow-lg transition-colors ${
            isSuccess ? "bg-green-500" : "bg-[#FF6B00] hover:bg-[#ff8022]"
          }`}
        >
          {isSuccess ? (
            <ShieldCheck className="h-6 w-6 text-white" />
          ) : (
            <ChevronRight className="h-6 w-6 text-white" />
          )}
        </motion.div>

        {/* Estado de Sucesso */}
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-green-500/10 text-xs font-black text-green-400 uppercase tracking-tighter"
          >
            Verificado com Sucesso
          </motion.div>
        )}
      </div>
    </div>
  );
}
