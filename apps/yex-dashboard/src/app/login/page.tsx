"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Lock, Mail, ArrowRight } from "lucide-react";
import SliderCaptcha from "@/modulos/compartilhado/SliderCaptcha";
import { motion } from "framer-motion";

export default function PaginaLogin() {
  const [loading, setLoading] = useState(false);
  const [captchaResolvido, setCaptchaResolvido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aoSubmeter = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    if (!captchaResolvido) {
      setErro("Por favor, resolva o captcha de segurança.");
      return;
    }

    const form = new FormData(evento.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const senha = String(form.get("senha") ?? "");

    setLoading(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
        credentials: "same-origin",
      });

      const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível entrar. Tente novamente.");
        return;
      }

      window.location.href = "/";
    } catch {
      setErro("Falha de conexão com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-transparent">
      {/* Camada escura por cima do fundo global (vídeo ou neutro) para legibilidade do login */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/92 via-black/55 to-black/70" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[2.5rem] bg-white/5 p-10 shadow-[0_0_80px_rgba(0,0,0,0.5)] backdrop-blur-[30px] border border-white/10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-8"
          >
            <Image
              src="/logo-yex.png"
              alt="Logo Yex"
              width={80}
              height={80}
              className="object-contain"
              unoptimized
            />
          </motion.div>
          <h1 className="text-3xl font-black tracking-tighter text-white">Yex Dashboard</h1>
          <p className="text-[11px] text-[#FFD100] font-bold tracking-[0.25em] uppercase mt-2">
            Acesso Restrito
          </p>
        </div>

        <form onSubmit={aoSubmeter} className="flex flex-col gap-4" noValidate>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
              <Mail className="h-5 w-5 text-white/30 transition-colors group-focus-within:text-white" />
            </div>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="E-mail corporativo"
              className="w-full rounded-2xl bg-black/60 px-14 py-4 text-white placeholder-white/20 border border-white/5 focus:outline-none focus:border-white/30 transition-all font-medium"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
              <Lock className="h-5 w-5 text-white/30 transition-colors group-focus-within:text-white" />
            </div>
            <input
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Senha de acesso"
              className="w-full rounded-2xl bg-black/60 px-14 py-4 text-white placeholder-white/20 border border-white/5 focus:outline-none focus:border-white/30 transition-all font-medium"
            />
          </div>

          {/* Slider Captcha Desafiador */}
          <SliderCaptcha onSuccess={() => setCaptchaResolvido(true)} />

          {erro && (
            <p className="text-red-400 text-[11px] font-bold text-center mt-2 animate-pulse">
              {erro}
            </p>
          )}

          <motion.button
            whileHover={{ scale: captchaResolvido ? 1.02 : 1 }}
            whileTap={{ scale: captchaResolvido ? 0.98 : 1 }}
            type="submit"
            disabled={loading || !captchaResolvido}
            className={`group relative mt-6 flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 font-bold text-white transition-all shadow-xl ${
              captchaResolvido
                ? "bg-[#FF6B00] hover:bg-[#ff8022] shadow-[#FF6B00]/20"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            ) : (
              <>
                <span className="text-lg">Entrar</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
              </>
            )}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-[10px] font-medium text-white/20 uppercase tracking-widest">
          Auth System v2.0 • Yex Security
        </p>
      </motion.div>

      {/* Rodapé Techfala */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none"
      >
        <p className="text-[11px] font-bold tracking-[0.3em] text-white/30 uppercase">
          Uma plataforma by <span className="text-white/60">Techfala</span>
        </p>
      </motion.div>
    </div>
  );
}
