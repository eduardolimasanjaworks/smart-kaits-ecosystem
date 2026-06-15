import { NextResponse, type NextRequest } from "next/server";
import { urlApiCrm } from "@/lib/crm/urlApiCrm";

export async function GET() {
  const res = await fetch(`${urlApiCrm()}/cupons`, { cache: "no-store" });
  const dados = await res.json();
  return NextResponse.json(dados, { status: res.status });
}

export async function POST(requisicao: NextRequest) {
  const res = await fetch(`${urlApiCrm()}/cupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await requisicao.text(),
  });
  const dados = await res.json();
  return NextResponse.json(dados, { status: res.status });
}
