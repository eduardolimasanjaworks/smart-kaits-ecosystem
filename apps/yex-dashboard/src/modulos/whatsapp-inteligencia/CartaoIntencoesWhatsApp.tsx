// Card de intenções do WhatsApp: destaca picos de perguntas para guiar operação e marketing.
import { LIMIAR_PESO_INTENCAO_WHATSAPP } from "@/constantes/limiaresAlerta";
import type { BlocoWhatsapp } from "@/dominio/contratos/tiposKpi";
import CartaoVidro from "@/modulos/compartilhado/CartaoVidro";

type PropriedadesCartaoIntencoesWhatsApp = {
  bloco: BlocoWhatsapp;
};

export default function CartaoIntencoesWhatsApp({ bloco }: PropriedadesCartaoIntencoesWhatsApp) {
  const maiorPeso = Math.max(...bloco.intencoes.map((item) => item.peso), 0);
  const emAlerta = maiorPeso >= LIMIAR_PESO_INTENCAO_WHATSAPP;

  return (
    <CartaoVidro titulo="WhatsApp — intenções" variante={emAlerta ? "alerta" : "padrao"}>
      <ul className="space-y-1.5">
        {bloco.intencoes.map((item) => {
          const destaque = item.peso >= LIMIAR_PESO_INTENCAO_WHATSAPP;
          return (
            <li
              key={item.rotulo}
              className={
                destaque
                  ? "flex items-center justify-between rounded-lg border border-acento-alerta/30 bg-acento-vermelhoClaro px-3 py-2"
                  : "flex items-center justify-between rounded-lg border border-borda-sutil bg-fundo-profundo px-3 py-2"
              }
            >
              <span className="text-xs font-medium text-texto-principal">{item.rotulo}</span>
              <span
                className={
                  destaque
                    ? "text-xs font-bold text-acento-alerta"
                    : "text-xs font-semibold text-texto-secundario"
                }
              >
                {item.peso}%
              </span>
            </li>
          );
        })}
      </ul>
    </CartaoVidro>
  );
}
