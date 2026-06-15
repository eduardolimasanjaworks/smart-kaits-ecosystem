// Rota do modo TV: layout full-screen com carrossel e tipografia ampliada para leitura à distância.
import obterInstanciaRepositorioKpi from "@/dominio/repositorio/obterInstanciaRepositorioKpi";
import PainelRotacaoTv from "@/modulos/modo-tv/PainelRotacaoTv";
import Link from "next/link";

export default async function PaginaModoTv() {
  const repositorio = obterInstanciaRepositorioKpi();
  const kpis = await repositorio.obterConsolidado();

  return (
    <div className="min-h-dvh text-[1.05rem] leading-relaxed">
      <div className="absolute right-4 top-4 z-[60]">
        <Link
          className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-texto-principal backdrop-blur-md hover:bg-black/55"
          href="/"
        >
          Voltar ao painel
        </Link>
      </div>
      <PainelRotacaoTv kpis={kpis} />
    </div>
  );
}
