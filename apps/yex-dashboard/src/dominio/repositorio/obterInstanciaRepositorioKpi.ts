// Fábrica do repositório: escolhe HTTP ou memória via variável de ambiente (injeção simples).
import type { KpiRepositorio } from "@/dominio/repositorio/KpiRepositorio";
import KpiRepositorioHttp from "@/dominio/repositorio/KpiRepositorioHttp";
import KpiRepositorioMemoria from "@/dominio/repositorio/KpiRepositorioMemoria";

const CHAVE_ENV_USAR_HTTP = "USAR_HTTP_KPI";
const CHAVE_ENV_URL_BASE = "NEXT_PUBLIC_APP_URL";

export default function obterInstanciaRepositorioKpi(): KpiRepositorio {
  const usarHttp = process.env[CHAVE_ENV_USAR_HTTP] === "1";
  if (usarHttp) {
    const urlBase = process.env[CHAVE_ENV_URL_BASE] ?? "http://127.0.0.1:3000";
    return new KpiRepositorioHttp({ urlBase });
  }
  return new KpiRepositorioMemoria();
}
