// Componente de vídeo de fundo embaçado (Corporate Light) com transição suave.
"use client";

import { useEffect, useRef, useState } from "react";
import mesclarClasses from "@/lib/utils/mesclarClasses";

const VIDEOS = [
  "/videos/snapinsta.com.br-69fb963f0141e.mp4",
  "/videos/snapinsta.com.br-69fb965768ca3.mp4",
  "/videos/snapinsta.com.br-69fb96695c9c3.mp4",
];

export default function BackgroundVideo() {
  const [indiceAtual, definirIndiceAtual] = useState(0);
  const [indiceProximo, definirIndiceProximo] = useState(1);
  const [trocando, setTrocando] = useState(false);

  // Usamos duas tags de vídeo para fazer fade entre elas (crossfade suave)
  const videoAtualRef = useRef<HTMLVideoElement>(null);
  const videoProximoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoAtual = videoAtualRef.current;
    if (!videoAtual) return;

    const aoTerminar = () => {
      // Inicia a transição
      setTrocando(true);

      // Dá play no próximo vídeo
      if (videoProximoRef.current) {
        videoProximoRef.current.currentTime = 0;
        videoProximoRef.current.play().catch(() => {});
      }

      // Após o fadeout (1s), troca os índices
      setTimeout(() => {
        definirIndiceAtual((prev) => (prev + 1) % VIDEOS.length);
        definirIndiceProximo((prev) => (prev + 1) % VIDEOS.length);
        setTrocando(false);
      }, 1000);
    };

    videoAtual.addEventListener("ended", aoTerminar);
    return () => videoAtual.removeEventListener("ended", aoTerminar);
  }, [indiceAtual]);

  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setOpacity(1);
    };

    // Fade out suave quando o mouse sai da tela ou fica parado (opcional)
    const handleLeave = () => setOpacity(0);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden bg-fundo-profundo">
      {/* Vídeo atual */}
      <video
        ref={videoAtualRef}
        src={VIDEOS[indiceAtual]}
        autoPlay
        muted
        playsInline
        className={mesclarClasses(
          "absolute h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
          trocando ? "opacity-0" : "opacity-100",
        )}
      />

      {/* Próximo vídeo */}
      <video
        ref={videoProximoRef}
        src={VIDEOS[indiceProximo]}
        muted
        playsInline
        className={mesclarClasses(
          "absolute h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
          trocando ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Camada de vidro com Efeito Spotlight (Gradiente suavizado e 100% nítido) */}
      <div
        className="absolute inset-0 bg-white/40 backdrop-blur-[15px] transition-opacity duration-700"
        style={{
          maskImage: `radial-gradient(circle 160px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, transparent 50%, black 100%)`,
          WebkitMaskImage: `radial-gradient(circle 160px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, transparent 50%, black 100%)`,
          opacity: opacity,
        }}
      />

      {/* Luz de destaque (Spotlight Glow) - Suave e envolvente */}
      <div
        className="absolute inset-0 transition-opacity duration-700 mix-blend-overlay pointer-events-none"
        style={{
          background: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.5) 0%, transparent 100%)`,
          opacity: opacity,
        }}
      />

      {/* Camada de blur fixo */}
      <div
        className={`absolute inset-0 bg-white/40 backdrop-blur-[15px] transition-opacity duration-1000 ${opacity > 0 ? "opacity-0" : "opacity-100"}`}
      />

      {/* Camada de profundidade (Vinheta suave) */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none" />
    </div>
  );
}
