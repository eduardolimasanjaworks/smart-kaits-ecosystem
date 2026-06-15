"use client";

import React, { useState, useEffect } from "react";
import Lottie from "lottie-react";
import introBoliche1 from "@/lotties/300_riseodbowling_intro.json";
import introBoliche2 from "@/lotties/Infinite Bowling.json";
import { motion, AnimatePresence } from "framer-motion";

const LOTTIES = [introBoliche1, introBoliche2];

export default function LottieIntro() {
  const [visivel, setVisivel] = useState(true);
  const [animacaoAleatoria, setAnimacaoAleatoria] = useState<any>(null);

  useEffect(() => {
    // Para evitar hydratation mismatch, selecionamos aleatoriamente no cliente
    const aleatoria = LOTTIES[Math.floor(Math.random() * LOTTIES.length)];
    setAnimacaoAleatoria(aleatoria);
  }, []);

  if (!visivel) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="intro-lottie"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#050505] overflow-hidden"
      >
        {animacaoAleatoria ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <Lottie
              animationData={animacaoAleatoria}
              loop={false}
              onComplete={() => setVisivel(false)}
              rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
              style={{ width: "100vw", height: "100vh", position: "absolute", top: 0, left: 0 }}
            />
          </motion.div>
        ) : (
          <div className="w-8 h-8 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin"></div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
