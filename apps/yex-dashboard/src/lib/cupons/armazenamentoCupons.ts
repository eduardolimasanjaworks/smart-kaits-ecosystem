import { urlApiCrm } from "@/lib/crm/urlApiCrm";

export type StatusCupom = "ativo" | "usado" | "expirado";

export type CupomPersistido = {
  id: string;
  token: string;
  codigo: string;
  nome: string;
  motivo: string;
  descontoPercentual: number;
  validade: string;
  status: StatusCupom;
  queimadoEm: string | null;
  criadoEm: string;
};

export async function lerCupons(): Promise<CupomPersistido[]> {
  const res = await fetch(`${urlApiCrm()}/cupons`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao listar cupons na API CRM");
  const dados = (await res.json()) as { cupons: CupomPersistido[] };
  return dados.cupons ?? [];
}

export async function gravarCupons(_cupons: CupomPersistido[]) {
  throw new Error("Use a API CRM para persistir cupons");
}
