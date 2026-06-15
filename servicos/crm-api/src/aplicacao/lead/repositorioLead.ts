// Listagem paginada de leads com busca por nome do contato.
import { desc, ilike, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';

type Db = NodePgDatabase<typeof schema>;

export type ConsultaListarLeads = {
  limit: number;
  offset: number;
  q?: string;
};

/**
 * Lista leads com paginação offset/limit e filtro opcional por nome.
 */
export async function listarLeadsPaginados(db: Db, consulta: ConsultaListarLeads) {
  const filtroNome = consulta.q
    ? ilike(schema.tabelaLead.nomeContato, `%${consulta.q}%`)
    : undefined;

  const leads = await db
    .select({
      id: schema.tabelaLead.id,
      nomeContato: schema.tabelaLead.nomeContato,
      emailContato: schema.tabelaLead.emailContato,
      telefoneContato: schema.tabelaLead.telefoneContato,
      criadoEm: schema.tabelaLead.criadoEm,
    })
    .from(schema.tabelaLead)
    .where(filtroNome)
    .orderBy(desc(schema.tabelaLead.criadoEm))
    .limit(consulta.limit)
    .offset(consulta.offset);

  const [contagem] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.tabelaLead)
    .where(filtroNome);

  return {
    leads,
    total: contagem?.total ?? 0,
    limit: consulta.limit,
    offset: consulta.offset,
  };
}
