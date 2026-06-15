// Cliente HTTP para KPIs: consome a rota interna com validação Zod (prepara Directus/BFF).
import type { KpisConsolidado } from "@/dominio/contratos/tiposKpi";
import type { KpiRepositorio } from "@/dominio/repositorio/KpiRepositorio";
import { esquemaKpisConsolidado } from "@/dominio/validacao/esquemaKpisConsolidado";

export type ConfiguracaoKpiRepositorioHttp = {
  urlBase: string;
};

export default class KpiRepositorioHttp implements KpiRepositorio {
  constructor(private readonly configuracao: ConfiguracaoKpiRepositorioHttp) {}

  async obterConsolidado(): Promise<KpisConsolidado> {
    const resposta = await fetch(`${this.configuracao.urlBase}/api/metricas`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!resposta.ok) {
      throw new Error(`Falha ao obter KPIs: HTTP ${resposta.status}`);
    }
    const jsonBruto: unknown = await resposta.json();
    const analise = esquemaKpisConsolidado.safeParse(jsonBruto);
    if (!analise.success) {
      throw new Error("Payload de KPIs inválido");
    }
    return analise.data;
  }
}
