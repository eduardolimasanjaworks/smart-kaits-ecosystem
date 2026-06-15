"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import mesclarClasses from "@/lib/utils/mesclarClasses";

type SortableItemProps = {
  id: string;
  children: ReactNode;
  className?: string;
  delayClass?: string;
};

export default function SortableItem({ id, children, className, delayClass }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    // Interpolação de mola / Spring physics vêm do transition do dnd-kit
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Se estiver arrastando, joga o z-index pra cima e dá um scale e shadow (Magic Motion / Magnetismo)
      className={mesclarClasses(
        className,
        delayClass,
        "cinematic-enter", // Mantemos a animação cinematográfica de carregamento
        // Quando está sendo arrastado (no grid original), vira um "slot fantasma" transparente
        isDragging ? "opacity-30 border-dashed bg-fundo-profundo/20 z-0" : "",
      )}
    >
      {/* Container invisível que repassa os listeners de drag para o handle (se o handle quiser usar, ou podemos aplicar na div toda) */}
      <div className="relative h-full w-full">
        {/* Passamos o id via context ou deixamos a div inteira arrastável se não houver handle específico. */}
        {/* Para usar um drag handle, o dnd-kit recomenda repassar listeners/attributes, 
            vamos expor eles globalmente para o CartaoVidro via Context ou aplicar aqui no root.
            Por simplicidade, vamos aplicar os atributos de arrasto na borda superior ou via um handler repassado.
            Mas podemos aplicar na div toda por enquanto. */}
        <div
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="absolute right-4 top-4 z-20 cursor-grab active:cursor-grabbing text-texto-secundario/50 hover:text-texto-principal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>
        {children}
      </div>
    </div>
  );
}
