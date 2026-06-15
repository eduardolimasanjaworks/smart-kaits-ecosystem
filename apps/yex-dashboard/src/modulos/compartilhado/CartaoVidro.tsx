"use client";
// Cartão base do Bento: variantes padrão, destaque e alerta — tema corporate-light.
// Por que: bordas coloridas na lateral esquerda são o padrão de alerta corporativo (Linear, Jira).
import mesclarClasses from "@/lib/utils/mesclarClasses";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type VarianteCartao = "padrao" | "destaque" | "alerta";

type PropriedadesCartaoVidro = {
  titulo?: string;
  variante?: VarianteCartao;
  children: ReactNode;
  className?: string;
};

export default function CartaoVidro({
  titulo,
  variante = "padrao",
  children,
  className,
}: PropriedadesCartaoVidro) {
  const estaEmAlerta = variante === "alerta";
  const estaDestaque = variante === "destaque";

  return (
    <motion.section
      whileHover={{ scale: 1.02, y: -6 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={mesclarClasses(
        "group flex h-full flex-col rounded-2xl border bg-fundo-container shadow-cartao transition-shadow duration-300 hover:shadow-xl overflow-hidden will-change-transform",
        estaEmAlerta
          ? "border-l-4 border-l-acento-alerta border-borda-sutil shadow-cartaoAlerta"
          : estaDestaque
            ? "border-l-4 border-l-acento-roxo border-borda-sutil"
            : "border-borda-sutil",
        className,
      )}
    >
      {titulo ? (
        <header className="flex items-center justify-between border-b border-borda-sutil px-5 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
            {titulo}
          </h2>
          {estaEmAlerta ? (
            <span className="rounded-full bg-acento-vermelhoClaro px-2 py-0.5 text-[10px] font-semibold text-acento-alerta">
              Atenção
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="flex flex-1 flex-col p-5 text-sm">{children}</div>
    </motion.section>
  );
}
