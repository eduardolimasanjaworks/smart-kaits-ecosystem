// Implementação em memória do repositório de KPIs para MVP e testes de integração leves.
import type { KpisConsolidado } from "@/dominio/contratos/tiposKpi";
import type { KpiRepositorio } from "@/dominio/repositorio/KpiRepositorio";
import obterDadosMockKpis from "@/dominio/repositorio/obterDadosMockKpis";

export default class KpiRepositorioMemoria implements KpiRepositorio {
  async obterConsolidado(): Promise<KpisConsolidado> {
    return obterDadosMockKpis();
  }
}
