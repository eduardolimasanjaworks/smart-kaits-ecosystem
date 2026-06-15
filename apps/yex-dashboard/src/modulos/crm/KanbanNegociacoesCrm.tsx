"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Plus } from "lucide-react";
import CartaoNegociacaoCrm from "./CartaoNegociacaoCrm";
import DetalheNegociacaoDrawer from "./DetalheNegociacaoDrawer";
import FormNovaNegociacaoCrm from "./FormNovaNegociacaoCrm";
import { urlApiCrm } from "./crmApi";
import type { ColunaKanban, NegociacaoKanban } from "./tiposNegociacao";

function idSortColuna(colunaId: string) {
  return `col-sort-${colunaId}`;
}

function idDropColuna(colunaId: string) {
  return `drop-${colunaId}`;
}

/** Pré-visualização da coluna presa ao cursor (sem sortable/droppable internos). */
function PreviewColunaKanbanOverlay({ coluna }: { coluna: ColunaKanban }) {
  return (
    <div className="pointer-events-none flex w-72 shrink-0 rotate-[-1deg] cursor-grabbing flex-col rounded-2xl border-2 border-[#FF6B00] bg-white p-3 shadow-2xl ring-2 ring-[#FF6B00]/25">
      <div className="mb-2 flex items-center gap-2 border-b border-borda-sutil pb-2">
        <GripVertical className="h-5 w-5 shrink-0 text-[#FF6B00]" aria-hidden />
        <h3 className="min-w-0 truncate text-xs font-black uppercase tracking-wider text-slate-800">
          {coluna.titulo}
          <span className="ml-1 tabular-nums font-bold text-texto-principal">({coluna.negociacoes.length})</span>
        </h3>
      </div>
      <p className="rounded-lg bg-fundo-profundo py-3 text-center text-[11px] font-bold text-slate-600">
        Solte para reordenar a etapa
      </p>
    </div>
  );
}

function ColunaKanban({
  coluna,
  onAbrir,
  onAlternarCriacao,
  onRenomearTitulo,
}: {
  coluna: ColunaKanban;
  onAbrir: (id: string) => void;
  onAlternarCriacao: (coluna: ColunaKanban) => void;
  onRenomearTitulo: (colunaId: string, titulo: string) => Promise<boolean>;
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState(coluna.titulo);
  const [salvandoTitulo, setSalvandoTitulo] = useState(false);

  useEffect(() => {
    if (!editandoTitulo) setTituloRascunho(coluna.titulo);
  }, [coluna.titulo, editandoTitulo]);
  const sortableId = idSortColuna(coluna.id);
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: arrastandoColuna,
  } = useSortable({
    id: sortableId,
    data: { tipo: "coluna" as const, colunaId: coluna.id },
    /** Com DragOverlay no pai, animar o layout da coluna “fantasma” piora a sensação de arraste. */
    animateLayoutChanges: () => false,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: idDropColuna(coluna.id),
    data: { tipo: "zonaColuna" as const, colunaId: coluna.id },
  });
  const vazia = coluna.negociacoes.length === 0;

  const estiloColuna: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: arrastandoColuna ? undefined : transition,
    opacity: arrastandoColuna ? 0.35 : 1,
  };

  return (
    <div
      ref={setSortableRef}
      style={estiloColuna}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-white p-3 shadow-cartao ring-1 ring-black/[0.04] ${
        isOver ? "border-[#FF6B00] ring-[#FF6B00]/25" : "border-borda-sutil"
      } ${arrastandoColuna ? "z-10 shadow-md" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {editandoTitulo ? (
            <form
              className="flex min-w-0 flex-1 flex-col gap-1"
              onPointerDown={(ev) => ev.stopPropagation()}
              onSubmit={(ev) => {
                ev.preventDefault();
                void (async () => {
                  const t = tituloRascunho.trim();
                  if (t.length < 1 || t === coluna.titulo) {
                    setEditandoTitulo(false);
                    setTituloRascunho(coluna.titulo);
                    return;
                  }
                  setSalvandoTitulo(true);
                  const ok = await onRenomearTitulo(coluna.id, t);
                  setSalvandoTitulo(false);
                  if (ok) setEditandoTitulo(false);
                })();
              }}
            >
              <input
                className="w-full min-w-0 rounded border border-borda-sutil px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-texto-principal"
                value={tituloRascunho}
                onChange={(ev) => setTituloRascunho(ev.target.value)}
                maxLength={200}
                disabled={salvandoTitulo}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  disabled={salvandoTitulo}
                  className="rounded bg-[#FF6B00] px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="rounded border border-borda-sutil px-2 py-0.5 text-[10px] font-bold text-slate-700"
                  onClick={() => {
                    setTituloRascunho(coluna.titulo);
                    setEditandoTitulo(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div
              className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1 active:cursor-grabbing"
              {...listeners}
              {...attributes}
              role="button"
              tabIndex={0}
              aria-label={`Arrastar coluna ${coluna.titulo} para reordenar`}
              title="Arraste pelo título ou alça para reordenar"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borda-sutil bg-fundo-profundo text-slate-600">
                <GripVertical className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-wider text-slate-800">
                {coluna.titulo}
                <span className="ml-1 tabular-nums font-bold text-texto-principal">({coluna.negociacoes.length})</span>
              </h3>
              <button
                type="button"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={() => setEditandoTitulo(true)}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-fundo-profundo hover:text-[#FF6B00]"
                title="Renomear etapa"
                aria-label={`Renomear coluna ${coluna.titulo}`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAlternarCriacao(coluna)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borda-sutil bg-fundo-profundo text-lg font-bold text-[#FF6B00] transition hover:bg-[#FF6B00]/10"
          aria-label={`Nova negociação em ${coluna.titulo}`}
          title="Nova negociação nesta coluna"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div ref={setDropRef} className="flex min-h-[100px] flex-1 flex-col gap-2">
        {vazia ? (
          <p className="rounded-lg border border-dashed border-borda-sutil py-6 text-center text-[11px] font-medium leading-relaxed text-slate-800">
            Arraste um card até aqui ou use o +
          </p>
        ) : (
          coluna.negociacoes.map((n) => <CartaoNegociacaoCrm key={n.id} neg={n} onAbrir={onAbrir} />)
        )}
      </div>
    </div>
  );
}

export default function KanbanNegociacoesCrm() {
  const [colunas, setColunas] = useState<ColunaKanban[]>([]);
  const [quadroId, setQuadroId] = useState<string | null>(null);
  const [ativo, setAtivo] = useState<NegociacaoKanban | null>(null);
  const [colunaArrastando, setColunaArrastando] = useState<ColunaKanban | null>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaEmColunaId, setNovaEmColunaId] = useState<string | null>(null);
  const [formNovaColuna, setFormNovaColuna] = useState(false);
  const [tituloNovaColuna, setTituloNovaColuna] = useState("");
  const [criandoColuna, setCriandoColuna] = useState(false);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const idsOrdenColunas = useMemo(() => colunas.map((c) => idSortColuna(c.id)), [colunas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const raiz = urlApiCrm().replace(/\/$/, "");
      const q = await fetch(`${raiz}/quadros/padrao`, { credentials: "same-origin" });
      if (!q.ok) throw new Error(`CRM ${q.status}`);
      const qd = (await q.json()) as { quadro?: { id?: string } };
      const quadroIdRes = qd.quadro?.id;
      if (!quadroIdRes) throw new Error("quadro indefinido");
      setQuadroId(quadroIdRes);

      const k = await fetch(`${raiz}/kanban/${quadroIdRes}`, { credentials: "same-origin" });
      if (!k.ok) throw new Error(`Kanban ${k.status}`);
      const kd = (await k.json()) as { colunas?: ColunaKanban[] };
      setColunas(Array.isArray(kd.colunas) ? kd.colunas : []);
    } catch {
      setErro("Não foi possível carregar o funil (API CRM). Confirme login e recarregue a página.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const persistirOrdemColunas = useCallback(async (ordenadas: ColunaKanban[]) => {
    const raiz = urlApiCrm().replace(/\/$/, "");
    try {
      await Promise.all(
        ordenadas.map((col, i) =>
          fetch(`${raiz}/colunas/${col.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ ordemPosicao: i }),
          }).then((r) => {
            if (!r.ok) throw new Error(`ordem ${i}`);
          }),
        ),
      );
    } catch {
      void carregar();
    }
  }, [carregar]);

  const renomearColuna = useCallback(async (colunaId: string, titulo: string) => {
    const raiz = urlApiCrm().replace(/\/$/, "");
    const r = await fetch(`${raiz}/colunas/${colunaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ titulo: titulo.trim() }),
    });
    if (!r.ok) {
      alert("Não foi possível renomear a etapa.");
      return false;
    }
    try {
      const j = (await r.json()) as { coluna?: { titulo?: string } };
      const novoTitulo = j.coluna?.titulo ?? titulo.trim();
      setColunas((prev) => prev.map((c) => (c.id === colunaId ? { ...c, titulo: novoTitulo } : c)));
    } catch {
      void carregar();
      return false;
    }
    return true;
  }, [carregar]);

  const aoSoltar = async (e: DragEndEvent) => {
    setAtivo(null);
    setColunaArrastando(null);
    const activeId = String(e.active.id);
    const overId = e.over?.id != null ? String(e.over.id) : null;

    if (activeId.startsWith("col-sort-")) {
      if (!overId?.startsWith("col-sort-")) return;
      const oldIndex = idsOrdenColunas.indexOf(activeId);
      const newIndex = idsOrdenColunas.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const novas = arrayMove(colunas, oldIndex, newIndex);
      setColunas(novas);
      await persistirOrdemColunas(novas);
      return;
    }

    if (!overId) return;
    const m = /^drop-(.+)$/.exec(overId);
    const colunaDestino = m?.[1] ?? null;
    if (!colunaDestino) return;

    const negId = activeId;
    const neg = colunas.flatMap((c) => c.negociacoes).find((n) => n.id === negId);
    if (!neg || neg.colunaId === colunaDestino) return;

    const colOrigemId = neg.colunaId;
    const negAtualizado: NegociacaoKanban = { ...neg, colunaId: colunaDestino };

    setColunas((prev) =>
      prev.map((c) => {
        if (c.id === colOrigemId) {
          return { ...c, negociacoes: c.negociacoes.filter((n) => n.id !== negId) };
        }
        if (c.id === colunaDestino) {
          return { ...c, negociacoes: [negAtualizado, ...c.negociacoes] };
        }
        return c;
      }),
    );

    const res = await fetch(`${urlApiCrm().replace(/\/$/, "")}/negociacoes/${negId}/mover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colunaId: colunaDestino }),
      credentials: "same-origin",
    });
    if (!res.ok) {
      void carregar();
    }
  };

  const criarColuna = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!quadroId || !tituloNovaColuna.trim()) return;
    setCriandoColuna(true);
    try {
      const raiz = urlApiCrm().replace(/\/$/, "");
      const r = await fetch(`${raiz}/quadros/${quadroId}/colunas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ titulo: tituloNovaColuna.trim() }),
      });
      if (!r.ok) {
        alert("Não foi possível criar a coluna. Tente outro título.");
        return;
      }
      setTituloNovaColuna("");
      setFormNovaColuna(false);
      void carregar();
    } finally {
      setCriandoColuna(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-acento-marca" />
      </div>
    );
  }

  if (erro) return <p className="p-8 text-center text-red-500">{erro}</p>;

  const colunaNova = novaEmColunaId ? colunas.find((c) => c.id === novaEmColunaId) : undefined;

  return (
    <div className="px-4 py-6">
      <DndContext
        sensors={sensores}
        onDragStart={(ev: DragStartEvent) => {
          const id = String(ev.active.id);
          if (id.startsWith("col-sort-")) {
            setAtivo(null);
            const colId = id.slice("col-sort-".length);
            const col = colunas.find((c) => c.id === colId);
            setColunaArrastando(col ?? null);
            return;
          }
          setColunaArrastando(null);
          const neg = colunas.flatMap((c) => c.negociacoes).find((n) => n.id === id);
          setAtivo(neg ?? null);
        }}
        onDragCancel={() => {
          setAtivo(null);
          setColunaArrastando(null);
        }}
        onDragEnd={(e) => void aoSoltar(e)}
      >
        <div className="flex flex-wrap items-start gap-4 overflow-x-auto pb-4">
          {quadroId ? (
            <SortableContext items={idsOrdenColunas} strategy={horizontalListSortingStrategy}>
              {colunas.map((c) => (
                <ColunaKanban
                  key={c.id}
                  coluna={c}
                  onRenomearTitulo={renomearColuna}
                  onAbrir={(id) => {
                    setNovaEmColunaId(null);
                    setAbertaId(id);
                  }}
                  onAlternarCriacao={(col) => {
                    setAbertaId(null);
                    setNovaEmColunaId((id) => (id === col.id ? null : col.id));
                  }}
                />
              ))}
            </SortableContext>
          ) : null}

          {quadroId && !formNovaColuna ? (
            <button
              type="button"
              onClick={() => setFormNovaColuna(true)}
              className="flex w-72 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-borda-sutil bg-fundo-profundo/50 py-10 text-sm font-black uppercase tracking-wide text-slate-600 transition hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/5 hover:text-[#FF6B00]"
            >
              <Plus className="h-6 w-6" aria-hidden />
              Nova etapa
            </button>
          ) : null}

          {quadroId && formNovaColuna ? (
            <form
              onSubmit={(e) => void criarColuna(e)}
              className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-borda-sutil bg-white p-4 shadow-cartao"
            >
              <p className="text-xs font-black uppercase tracking-wider text-slate-800">Nova etapa do funil</p>
              <input
                className="w-full rounded-lg border border-borda-sutil bg-fundo-profundo px-3 py-2 text-sm font-semibold text-texto-principal"
                placeholder="Nome da coluna (ex.: Proposta enviada)"
                value={tituloNovaColuna}
                onChange={(ev) => setTituloNovaColuna(ev.target.value)}
                maxLength={200}
                autoFocus
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormNovaColuna(false);
                    setTituloNovaColuna("");
                  }}
                  className="rounded-lg border border-borda-sutil px-3 py-1.5 text-xs font-bold text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoColuna || !tituloNovaColuna.trim()}
                  className="rounded-lg bg-[#FF6B00] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {criandoColuna ? "Criando…" : "Criar coluna"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
        <DragOverlay dropAnimation={null}>
          {ativo ? (
            <CartaoNegociacaoCrm neg={ativo} onAbrir={() => {}} />
          ) : colunaArrastando ? (
            <PreviewColunaKanbanOverlay coluna={colunaArrastando} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {quadroId && novaEmColunaId && colunaNova ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-nova-negociacao-modal"
          onClick={() => setNovaEmColunaId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <FormNovaNegociacaoCrm
              quadroId={quadroId}
              colunaId={colunaNova.id}
              etiquetaEtapa={colunaNova.titulo}
              onCancel={() => setNovaEmColunaId(null)}
              onCriada={() => {
                setNovaEmColunaId(null);
                void carregar();
              }}
            />
          </div>
        </div>
      ) : null}

      <DetalheNegociacaoDrawer
        negociacaoId={abertaId}
        onFechar={() => setAbertaId(null)}
        onSalvo={() => void carregar()}
      />

      <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-borda-sutil bg-white px-4 py-3 text-center text-xs font-semibold leading-relaxed text-slate-900 shadow-cartao">
        Use o ícone de alça para reordenar etapas · Lápis renomeia a etapa · &quot;Nova etapa&quot; cria coluna · Arraste cards entre colunas (atualização imediata) · &quot;+&quot; abre nova negociação.
      </p>
    </div>
  );
}
