// Porta de saída para leitura de KPIs: injete mock ou HTTP sem acoplar a UI ao transporte.
import type { KpisConsolidado } from "@/dominio/contratos/tiposKpi";

export interface KpiRepositorio {
  obterConsolidado(): Promise<KpisConsolidado>;
}
