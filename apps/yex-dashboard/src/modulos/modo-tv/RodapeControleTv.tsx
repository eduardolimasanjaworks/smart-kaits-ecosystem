// Rodapé do modo TV: dots, navegação e pausa inspirados na referência HTML do projeto.
"use client";

import type { DefinicaoVisaoTv, VisaoTvId } from "@/constantes/visoesTv";
import mesclarClasses from "@/lib/utils/mesclarClasses";
import type { ReactNode } from "react";

type PropriedadesRodapeControleTv = {
  visoes: DefinicaoVisaoTv[];
  visaoAtivaId: VisaoTvId;
  indiceAtivo: number;
  pausado: boolean;
  aoSelecionar: (indice: number) => void;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoAlternarPausa: () => void;
};

export default function RodapeControleTv({
  visoes,
  visaoAtivaId,
  indiceAtivo,
  pausado,
  aoSelecionar,
  aoAnterior,
  aoProximo,
  aoAlternarPausa,
}: PropriedadesRodapeControleTv) {
  const visaoAtiva = visoes.find((visao) => visao.id === visaoAtivaId) ?? visoes[0];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-fundo-profundo/80 px-6 py-3 shadow-cartao backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8">
        <div className="flex min-w-[280px] items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-acento-sucesso" />
          <div>
            <p className="text-base font-bold text-acento-sucesso">{visaoAtiva.titulo}</p>
            <p className="text-xs text-texto-secundario">{visaoAtiva.subtitulo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {visoes.map((visao, indice) => {
            const ativo = indice === indiceAtivo;
            return (
              <button
                key={visao.id}
                type="button"
                aria-label={`Ir para ${visao.titulo}`}
                title={visao.titulo}
                onClick={() => aoSelecionar(indice)}
                className={mesclarClasses(
                  "h-3 rounded-full transition-all duration-300",
                  ativo
                    ? "w-16 bg-acento-sucesso shadow-cartao"
                    : "w-3 bg-texto-secundario hover:w-6 hover:bg-texto-principal/80",
                )}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <BotaoIcone ariaLabel="Visão anterior" onClick={aoAnterior}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </BotaoIcone>
          <BotaoIcone
            ariaLabel={pausado ? "Retomar rotação" : "Pausar rotação"}
            onClick={aoAlternarPausa}
            primario
          >
            {pausado ? <IconePlay /> : <IconePause />}
          </BotaoIcone>
          <BotaoIcone ariaLabel="Próxima visão" onClick={aoProximo}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                d="M9 18l6-6-6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </BotaoIcone>
        </div>
        <div className="min-w-[120px] text-right">
          <p className="text-xs font-medium text-texto-principal">
            {indiceAtivo + 1} / {visoes.length}
          </p>
          <p className="text-xs text-texto-secundario">{pausado ? "Pausado" : "Automático"}</p>
        </div>
      </div>
    </footer>
  );
}

type PropriedadesBotaoIcone = {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  primario?: boolean;
};

function BotaoIcone({ children, onClick, ariaLabel, primario }: PropriedadesBotaoIcone) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={
        primario
          ? "inline-flex h-9 w-9 items-center justify-center rounded-md border border-acento-sucesso/50 bg-acento-sucesso/90 text-fundo-profundo shadow-cartao hover:bg-acento-sucesso"
          : "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-texto-principal hover:bg-white/10"
      }
    >
      {children}
    </button>
  );
}

function IconePause() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconePlay() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}
