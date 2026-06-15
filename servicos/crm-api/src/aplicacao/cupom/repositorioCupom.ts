// Persistência e regras de negócio dos cupons promocionais.
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import { gerarCodigoCupom } from './gerarCodigoCupom.js';

type Db = NodePgDatabase<typeof schema>;
export type StatusCupom = 'ativo' | 'usado' | 'expirado';

export type CupomDto = {
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

function calcularStatus(validade: string, queimadoEm: Date | null): StatusCupom {
  if (queimadoEm) return 'usado';
  const fim = new Date(`${validade}T23:59:59.999`);
  if (new Date() > fim) return 'expirado';
  return 'ativo';
}

function paraDto(linha: typeof schema.tabelaCupom.$inferSelect): CupomDto {
  const validade = String(linha.validade);
  return {
    id: linha.id,
    token: linha.token,
    codigo: linha.codigo,
    nome: linha.nome,
    motivo: linha.motivo,
    descontoPercentual: linha.descontoPercentual,
    validade,
    status: calcularStatus(validade, linha.queimadoEm),
    queimadoEm: linha.queimadoEm?.toISOString() ?? null,
    criadoEm: linha.criadoEm.toISOString(),
  };
}

export async function listarCupons(db: Db): Promise<CupomDto[]> {
  const linhas = await db.select().from(schema.tabelaCupom).limit(500);
  return linhas.map(paraDto);
}

export async function criarCupom(
  db: Db,
  dados: { nome: string; motivo: string; descontoPercentual: number; validade: string },
  token: string,
): Promise<CupomDto> {
  const [linha] = await db
    .insert(schema.tabelaCupom)
    .values({
      token,
      codigo: gerarCodigoCupom(),
      nome: dados.nome,
      motivo: dados.motivo,
      descontoPercentual: dados.descontoPercentual,
      validade: dados.validade,
    })
    .returning();
  return paraDto(linha);
}

export async function atualizarCupom(
  db: Db,
  id: string,
  parcial: Partial<{ nome: string; motivo: string; descontoPercentual: number; validade: string }>,
): Promise<CupomDto | null> {
  const [linha] = await db
    .update(schema.tabelaCupom)
    .set(parcial)
    .where(eq(schema.tabelaCupom.id, id))
    .returning();
  return linha ? paraDto(linha) : null;
}

export async function excluirCupom(db: Db, id: string): Promise<boolean> {
  const removidos = await db.delete(schema.tabelaCupom).where(eq(schema.tabelaCupom.id, id)).returning({ id: schema.tabelaCupom.id });
  return removidos.length > 0;
}

export async function resgatarCupomPorToken(db: Db, token: string): Promise<{ ok: true; cupom: CupomDto } | { erro: string; status: number; cupom?: CupomDto }> {
  const [linha] = await db.select().from(schema.tabelaCupom).where(eq(schema.tabelaCupom.token, token)).limit(1);
  if (!linha) return { erro: 'Cupom não encontrado', status: 404 };
  const cupom = paraDto(linha);
  const agora = new Date();
  if (linha.queimadoEm) return { erro: 'Cupom já utilizado', status: 409, cupom };
  if (agora > new Date(`${cupom.validade}T23:59:59.999`)) {
    return { erro: 'Cupom expirado', status: 410, cupom };
  }
  const [queimado] = await db
    .update(schema.tabelaCupom)
    .set({ queimadoEm: agora })
    .where(eq(schema.tabelaCupom.id, linha.id))
    .returning();
  return { ok: true, cupom: paraDto(queimado) };
}
