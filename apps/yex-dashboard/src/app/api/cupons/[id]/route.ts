import { NextResponse, type NextRequest } from "next/server";
import { urlApiCrm } from "@/lib/crm/urlApiCrm";

export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const { id } = await contexto.params;
  const res = await fetch(`${urlApiCrm()}/cupons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await requisicao.text(),
  });
  const dados = await res.json();
  return NextResponse.json(dados, { status: res.status });
}

export async function DELETE(_requisicao: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const res = await fetch(`${urlApiCrm()}/cupons/${id}`, { method: "DELETE" });
  const dados = await res.json();
  return NextResponse.json(dados, { status: res.status });
}
