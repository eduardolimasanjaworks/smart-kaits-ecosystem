// Tokens Tailwind: tema corporate-light (Clear Strike).
// Marca preservada como accent; superfícies em cinza frio para leitura diurna.
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        fundo: {
          // Superfícies corporativas claras
          profundo: "#F0F2F5", // página / área externa
          container: "#FFFFFF", // cards e painéis
          sidebar: "#1E2A3A", // barra lateral escura (acento)
        },
        borda: {
          sutil: "#E2E8F0",
          media: "#CBD5E1",
        },
        texto: {
          principal: "#0F172A", // slate-900 — leitura primária
          // Mais escuro que slate-500: legível em fundo de vídeo / blur
          secundario: "#334155", // slate-700
          suave: "#64748B", // slate-500 — apenas onde quiser menor ênfase
          invertido: "#F8FAFC", // texto sobre fundos escuros
        },
        acento: {
          sucesso: "#16A34A", // green-700 (corporativo, não neon)
          alerta: "#DC2626", // red-600 (alerta sem ser gritante)
          marca: "#E10102", // marca Clear Strike (#d83b26 corporatizado)
          marcaSuave: "#FEF2F1", // rosa suave para bg de badge alerta
          roxo: "#3B2E54", // mantido da paleta original
          roxoSuave: "#F3F0F8", // bg suave para roxo
          verdeClaro: "#DCFCE7", // bg suave para sucesso
          vermelhoClaro: "#FEE2E2", // bg suave para alerta
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        cartao: "0 2px 8px -2px rgba(0,0,0,0.05)",
        cartaoHover: "0 8px 24px -4px rgba(0,0,0,0.08)",
        cartaoAlerta: "0 4px 20px -4px rgba(225, 1, 2, 0.15)",
        header: "0 1px 3px 0 rgba(0,0,0,0.02)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(15px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-delayed": "fadeInUp 0.8s ease-out 2.5s forwards",
      },
    },
  },
  plugins: [],
};

export default config;
