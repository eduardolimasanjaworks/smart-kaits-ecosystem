"use client";

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";

type Props = {
  token: string;
};

export default function ResgatarCupomCliente({ token }: Props) {
  const [estado, setEstado] = useState<"idle" | "processando" | "ok" | "erro">("idle");
  const [mensagem, setMensagem] = useState("");

  const confirmarResgate = async () => {
    setEstado("processando");
    setMensagem("");
    try {
      const res = await fetch("/api/cupons/resgatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const dados = (await res.json()) as { ok?: boolean; mensagem?: string; erro?: string; cupom?: { codigo?: string; nome?: string } };
      if (res.ok && dados.ok) {
        setEstado("ok");
        setMensagem(dados.mensagem ?? "Cupom resgatado com sucesso.");
      } else {
        setEstado("erro");
        setMensagem(dados.erro ?? "Não foi possível resgatar.");
      }
    } catch {
      setEstado("erro");
      setMensagem("Falha de rede. Tente novamente.");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-fundo-base px-6 py-16 text-texto-principal">
      <div className="w-full max-w-md rounded-2xl border border-borda-sutil bg-white p-10 text-center shadow-cartao ring-1 ring-black/[0.04]">
        <Gift className="mx-auto mb-4 h-14 w-14 text-acento-marca" aria-hidden />
        {estado === "idle" && (
          <>
            <h1 className="text-xl font-black tracking-tight">Resgatar cupom</h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
              Toque em confirmar para marcar este cupom como utilizado. Esta ação não pode ser desfeita.
            </p>
            <button
              type="button"
              onClick={() => void confirmarResgate()}
              className="mt-6 w-full rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-[#ff8022] active:scale-[0.98]"
            >
              Confirmar resgate
            </button>
          </>
        )}
        {estado === "processando" && (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
            <p className="text-sm font-medium text-slate-800">Processando resgate…</p>
          </>
        )}
        {estado === "ok" && (
          <>
            <h1 className="text-xl font-black tracking-tight">Tudo certo</h1>
            <p className="mt-2 text-sm font-medium text-slate-800">{mensagem}</p>
            <p className="mt-4 text-xs font-medium text-slate-700">
              Este cupom foi marcado como utilizado e não pode ser usado de novo.
            </p>
          </>
        )}
        {estado === "erro" && (
          <>
            <h1 className="text-xl font-black tracking-tight text-red-700">Não foi possível resgatar</h1>
            <p className="mt-2 text-sm font-medium text-slate-800">{mensagem}</p>
            <button
              type="button"
              onClick={() => setEstado("idle")}
              className="mt-6 text-xs font-bold text-acento-marca hover:underline"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}
