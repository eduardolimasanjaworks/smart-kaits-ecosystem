// Rota de leitura de KPIs: payload mínimo validado e log estruturado com TraceID.
import obterDadosMockKpis from "@/dominio/repositorio/obterDadosMockKpis";
import registrarLogEstruturado from "@/lib/observabilidade/registrarLogEstruturado";
import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const esquemaConsultaMetricas = z.object({
  traceId: z.string().uuid().optional(),
});

export async function GET(requisicao: NextRequest) {
  const analiseConsulta = esquemaConsultaMetricas.safeParse({
    traceId: requisicao.nextUrl.searchParams.get("traceId") ?? undefined,
  });
  if (!analiseConsulta.success) {
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  }
  const traceId = analiseConsulta.data.traceId ?? randomUUID();
  const inicio = performance.now();
  const corpo = obterDadosMockKpis();
  const duracaoMs = Math.round(performance.now() - inicio);
  registrarLogEstruturado({
    nivel: "INFO",
    mensagem: "metricas.get",
    traceId,
    contexto: { duracaoMs, rota: "api/metricas" },
  });
  return NextResponse.json(corpo, {
    headers: {
      "X-Trace-Id": traceId,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
