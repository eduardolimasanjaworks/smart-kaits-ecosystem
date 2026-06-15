import type { FiltroRelatorio } from "./tiposFiltroRelatorio";

export function montarQueryFiltros(f: FiltroRelatorio): string {
  const p = new URLSearchParams();
  p.set("inicio", f.inicio);
  p.set("fim", f.fim);
  if (f.tipoData) p.set("tipoData", f.tipoData);
  if (f.leadId) p.set("leadId", f.leadId);
  if (f.quadroId) p.set("quadroId", f.quadroId);
  f.resultados?.forEach((r) => p.append("resultado", r));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}
