"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Video, VideoOff } from "lucide-react";
import BackgroundVideo from "./BackgroundVideo";

const CHAVE_LS = "yex_pref_fundo_video";

/** Dispara atualização dos ouvintes (ex.: após ler LS em outra aba). */
function dispararPreferenciaAtualizada() {
  window.dispatchEvent(new CustomEvent("yex-fundo-video"));
}

export function lerPrefereVideo(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CHAVE_LS) !== "0";
}

export function gravarPreferenciaVideo(ativo: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE_LS, ativo ? "1" : "0");
  dispararPreferenciaAtualizada();
}

function subscreverPreferencia(callback: () => void) {
  window.addEventListener("yex-fundo-video", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("yex-fundo-video", callback);
    window.removeEventListener("storage", callback);
  };
}

function preferenciaDuranteHydrate(): boolean {
  return true;
}

/**
 * Fundo global: vídeo + camadas OU cinza neutro (sem vídeo, sem vidro pesado na base).
 * Preferência gravada localmente (`localStorage`).
 */
export default function FundoAplicacao() {
  const comVideo = useSyncExternalStore(
    subscreverPreferencia,
    lerPrefereVideo,
    preferenciaDuranteHydrate,
  );

  const alternar = useCallback(() => {
    gravarPreferenciaVideo(!lerPrefereVideo());
  }, []);

  return (
    <>
      {comVideo ? (
        <div className="pointer-events-none fixed inset-0 -z-50 opacity-[0.58]">
          <BackgroundVideo />
        </div>
      ) : (
        <div
          className="pointer-events-none fixed inset-0 -z-50 bg-fundo-profundo"
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={alternar}
        className="fixed bottom-4 right-4 z-[55] flex items-center gap-2 rounded-full border border-borda-sutil bg-white px-3 py-2 text-xs font-bold text-texto-principal shadow-cartao hover:bg-fundo-profundo focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
        title={
          comVideo
            ? "Desligar vídeo — fundo cinza neutro (menos cansativo)"
            : "Ligar vídeo animado no fundo"
        }
      >
        {comVideo ? (
          <>
            <VideoOff className="h-4 w-4 shrink-0 text-slate-700" aria-hidden />
            <span className="hidden sm:inline">Fundo neutro</span>
          </>
        ) : (
          <>
            <Video className="h-4 w-4 shrink-0 text-[#FF6B00]" aria-hidden />
            <span className="hidden sm:inline">Vídeo fundo</span>
          </>
        )}
      </button>
    </>
  );
}
