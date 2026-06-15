"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGrid, Plus } from "lucide-react";
import mesclarClasses from "@/lib/utils/mesclarClasses";

const CHAVE_STORAGE = "yex-kanban-v1";

const COLUNAS = ["a-fazer", "em-progresso", "feito"] as const;
type IdColuna = (typeof COLUNAS)[number];

const ROTULOS: Record<IdColuna, string> = {
  "a-fazer": "A fazer",
  "em-progresso": "Em progresso",
  feito: "Concluído",
};

type Tarefa = { id: string; titulo: string };

const estadoInicial = (): { colunas: Record<IdColuna, string[]>; tarefas: Record<string, Tarefa> } => ({
  colunas: {
    "a-fazer": ["t1", "t2"],
    "em-progresso": ["t3"],
    feito: [],
  },
  tarefas: {
    t1: { id: "t1", titulo: "Revisar cardápio" },
    t2: { id: "t2", titulo: "Contatar fornecedor" },
    t3: { id: "t3", titulo: "Treinar equipe" },
  },
});

function CartaoTarefa({ id, titulo }: { id: string; titulo: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const estilo = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={estilo}
      {...listeners}
      {...attributes}
      className={mesclarClasses(
        "cursor-grab rounded-2xl border border-borda-sutil bg-white px-4 py-3 text-sm font-semibold text-texto-principal shadow-cartao active:cursor-grabbing",
        isDragging ? "opacity-40 ring-2 ring-acento-marca/50" : "hover:border-acento-marca/40",
      )}
    >
      {titulo}
    </div>
  );
}

function ColunaKanban({
  id,
  titulo,
  idsFilhos,
  tarefas,
}: {
  id: IdColuna;
  titulo: string;
  idsFilhos: string[];
  tarefas: Record<string, Tarefa>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={mesclarClasses(
        "flex min-h-[320px] flex-1 flex-col gap-3 rounded-[2rem] border border-borda-sutil bg-fundo-profundo p-4 transition-colors",
        isOver ? "border-acento-marca/60 bg-white ring-2 ring-acento-marca/20" : "",
      )}
    >
      <div className="flex items-center justify-between border-b border-borda-sutil pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{titulo}</h3>
        <span className="rounded-full border border-borda-sutil bg-white px-2 py-0.5 text-xs font-bold text-slate-800">
          {idsFilhos.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {idsFilhos.map((tid) => {
          const t = tarefas[tid];
          if (!t) return null;
          return <CartaoTarefa key={tid} id={tid} titulo={t.titulo} />;
        })}
      </div>
    </div>
  );
}

export default function KanbanPainel() {
  const [colunas, setColunas] = useState<Record<IdColuna, string[]>>(() => estadoInicial().colunas);
  const [tarefas, setTarefas] = useState<Record<string, Tarefa>>(() => estadoInicial().tarefas);
  const [ativoId, setAtivoId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (!salvo) return;
      const parsed = JSON.parse(salvo) as { colunas?: Record<IdColuna, string[]>; tarefas?: Record<string, Tarefa> };
      if (parsed.colunas && parsed.tarefas) {
        setColunas(parsed.colunas);
        setTarefas(parsed.tarefas);
      }
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify({ colunas, tarefas }));
    } catch {
      /* ignora */
    }
  }, [colunas, tarefas]);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const colunaDaTarefa = useCallback(
    (taskId: string): IdColuna | null => {
      for (const c of COLUNAS) {
        if (colunas[c].includes(taskId)) return c;
      }
      return null;
    },
    [colunas],
  );

  const onInicioArraste = (e: DragStartEvent) => {
    setAtivoId(String(e.active.id));
  };

  const onFimArraste = (e: DragEndEvent) => {
    setAtivoId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const origem = colunaDaTarefa(taskId);
    if (!origem) return;

    let destino: IdColuna | null = null;
    if (COLUNAS.includes(over.id as IdColuna)) {
      destino = over.id as IdColuna;
    } else {
      destino = colunaDaTarefa(String(over.id));
    }
    if (!destino || destino === origem) return;

    setColunas((prev) => ({
      ...prev,
      [origem]: prev[origem].filter((id) => id !== taskId),
      [destino]: [...prev[destino], taskId],
    }));
  };

  const adicionarTarefa = () => {
    const titulo = window.prompt("Título do cartão:");
    if (!titulo?.trim()) return;
    const id = `t-${crypto.randomUUID().slice(0, 8)}`;
    setTarefas((prev) => ({ ...prev, [id]: { id, titulo: titulo.trim() } }));
    setColunas((prev) => ({ ...prev, "a-fazer": [...prev["a-fazer"], id] }));
  };

  const tarefaAtiva = ativoId ? tarefas[ativoId] : null;

  const colunasOrdenadas = useMemo(() => COLUNAS, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-texto-principal">Kanban</h2>
          <p className="text-sm font-medium text-slate-800">
            Arraste os cartões entre colunas. O quadro fica salvo neste navegador.
          </p>
        </div>
        <button
          type="button"
          onClick={adicionarTarefa}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#E65F00] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Novo cartão
        </button>
      </div>

      <DndContext sensors={sensores} onDragStart={onInicioArraste} onDragEnd={onFimArraste}>
        <div className="flex flex-col gap-4 lg:flex-row">
          {colunasOrdenadas.map((cid) => (
            <ColunaKanban
              key={cid}
              id={cid}
              titulo={ROTULOS[cid]}
              idsFilhos={colunas[cid]}
              tarefas={tarefas}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {tarefaAtiva ? (
            <div className="cursor-grabbing rounded-2xl border border-acento-marca/50 bg-white px-4 py-3 text-sm font-semibold text-texto-principal shadow-2xl ring-2 ring-acento-marca/30">
              <LayoutGrid className="mb-1 h-4 w-4 text-acento-marca" />
              {tarefaAtiva.titulo}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
