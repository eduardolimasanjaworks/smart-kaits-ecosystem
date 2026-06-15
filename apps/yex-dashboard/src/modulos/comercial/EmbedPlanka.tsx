"use client";

type EmbedPlankaProps = {
  url?: string;
};

export default function EmbedPlanka({ url }: EmbedPlankaProps) {
  const destino = url?.trim();

  if (!destino) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-borda-sutil bg-white p-10 text-center shadow-cartao">
        <p className="text-lg font-bold text-texto-principal">Planka não configurado</p>
        <p className="mt-3 text-sm text-texto-secundario">
          Defina <code className="rounded bg-fundo-profundo px-1">YEX_PLANKA_EMBED_URL</code> no servidor.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] w-full overflow-hidden rounded-2xl border border-borda-sutil bg-white shadow-cartao">
      <iframe
        title="Gestão de negociações — Planka"
        src={destino}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
