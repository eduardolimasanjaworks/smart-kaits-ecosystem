// Página inicial do Bento executivo: KPIs via repositório injectável (memória ou HTTP).
import obterInstanciaRepositorioKpi from "@/dominio/repositorio/obterInstanciaRepositorioKpi";
import CartaoFaturamentoGlobal from "@/modulos/faturamento-global/CartaoFaturamentoGlobal";
import CartaoAnoIndividual from "@/modulos/faturamento-global/CartaoAnoIndividual";
import {
  CartaoRestauranteSemana,
  CartaoRestauranteFimDeSemana,
} from "@/modulos/restaurante/CartaoRestaurante";
import {
  CartaoBolicheIndicadores,
  CartaoBolicheConsumoCruzado,
  CartaoBolicheRanking,
} from "@/modulos/boliche/CartaoBoliche";
import CartaoEventos from "@/modulos/eventos/CartaoEventos";
import CartaoIntencoesWhatsApp from "@/modulos/whatsapp-inteligencia/CartaoIntencoesWhatsApp";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import PortalDashboard from "@/modulos/compartilhado/PortalDashboard";
import LottieIntro from "@/modulos/compartilhado/LottieIntro";
import BotaoLogout from "@/modulos/compartilhado/BotaoLogout";
import { cookies } from "next/headers";
import type { PerfilUsuario } from "@/dominio/autenticacao/validarCredenciais";

export default async function PaginaInicial() {
  const cookieStore = await cookies();
  const perfil = (cookieStore.get("yex_role")?.value ?? "admin") as PerfilUsuario;
  const repositorio = obterInstanciaRepositorioKpi();
  const kpis = await repositorio.obterConsolidado();

  const itemsDashboard = [
    {
      id: "faturamento-grafico",
      defaultW: 8,
      defaultH: 3,
      minW: 4,
      minH: 2,
      categoria: "faturamento",
      component: <CartaoFaturamentoGlobal bloco={kpis.faturamentoGlobal} />,
    },
    {
      id: "faturamento-2024",
      defaultW: 2,
      defaultH: 3,
      minW: 2,
      minH: 2,
      categoria: "faturamento",
      component: (
        <CartaoAnoIndividual titulo="2024" fatias={{ restaurante: 48, boliche: 32, eventos: 20 }} />
      ),
    },
    {
      id: "faturamento-2025",
      defaultW: 2,
      defaultH: 3,
      minW: 2,
      minH: 2,
      categoria: "faturamento",
      component: (
        <CartaoAnoIndividual titulo="2025" fatias={{ restaurante: 44, boliche: 36, eventos: 20 }} />
      ),
    },
    {
      id: "restaurante-semana",
      defaultW: 4,
      defaultH: 2,
      minW: 3,
      minH: 2,
      categoria: "restaurante",
      component: <CartaoRestauranteSemana bloco={kpis.restaurante} />,
    },
    {
      id: "restaurante-fds",
      defaultW: 4,
      defaultH: 2,
      minW: 3,
      minH: 2,
      categoria: "restaurante",
      component: <CartaoRestauranteFimDeSemana bloco={kpis.restaurante} />,
    },
    {
      id: "boliche-indicadores",
      defaultW: 4,
      defaultH: 2,
      minW: 3,
      minH: 2,
      categoria: "boliche",
      component: <CartaoBolicheIndicadores bloco={kpis.boliche} />,
    },
    {
      id: "boliche-cruzado",
      defaultW: 6,
      defaultH: 2,
      minW: 4,
      minH: 1,
      categoria: "boliche",
      component: <CartaoBolicheConsumoCruzado bloco={kpis.boliche} />,
    },
    {
      id: "boliche-ranking",
      defaultW: 6,
      defaultH: 2,
      minW: 4,
      minH: 2,
      categoria: "boliche",
      component: <CartaoBolicheRanking bloco={kpis.boliche} />,
    },
    {
      id: "eventos",
      defaultW: 6,
      defaultH: 2,
      minW: 4,
      minH: 1,
      categoria: "eventos",
      component: <CartaoEventos bloco={kpis.eventos} />,
    },
    {
      id: "whatsapp",
      defaultW: 6,
      defaultH: 2,
      minW: 4,
      minH: 2,
      categoria: "IA",
      component: <CartaoIntencoesWhatsApp bloco={kpis.whatsapp} />,
    },
  ];

  return (
    <div className="min-h-dvh relative">
      <LottieIntro />
      {/* Header corporativo sólido (melhor contraste sobre o fundo) */}
      <header className="sticky top-0 z-30 hidden border-b border-borda-sutil bg-white shadow-header cinematic-enter delay-1 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2">
          {/* Identidade Yex Slim */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center">
              <Image
                src="/logo-yex.png"
                alt="Logo Yex"
                width={100}
                height={40}
                className="object-contain drop-shadow-md"
                unoptimized
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md border border-borda-sutil bg-fundo-profundo px-3 py-1.5 text-xs font-semibold text-slate-800 sm:inline">
              Atualizado hoje
            </span>
            {perfil === "admin" && (
              <Link
                id="btn-modo-tv"
                className="hidden sm:flex rounded-lg border border-borda-sutil bg-white px-4 py-2 text-xs font-semibold text-texto-principal shadow-sm transition-shadow hover:bg-fundo-profundo hover:shadow-cartaoHover"
                href="/modo-tv"
              >
                📺 Modo TV
              </Link>
            )}
            <BotaoLogout />
          </div>
        </div>
      </header>

      {/* Arquitetura Portal 3D (Level 0 -> Level 1) */}
      <PortalDashboard itemsDashboard={itemsDashboard} perfil={perfil} />
    </div>
  );
}
