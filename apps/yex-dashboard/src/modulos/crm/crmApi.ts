export { urlApiCrm } from "@/lib/crm/urlApiCrm";

export function centavosParaReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function reaisParaCentavos(texto: string) {
  return Math.round(Number(texto.replace(",", ".")) * 100) || 0;
}

/** Converte instante ISO em valor para `<input type="datetime-local" />` (fuso local). */
export function isoParaDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function datetimeLocalParaIso(local: string): string {
  return new Date(local).toISOString();
}
