// Seed idempotente: quadro padrão Yex, colunas do funil e produtos exemplo.
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/indiceSchema.js';

const TITULO_QUADRO_PADRAO = 'Funil Comercial Yex';

export async function executarSeedInicial(db: NodePgDatabase<typeof schema>) {
  const existente = await db
    .select({ id: schema.tabelaQuadro.id })
    .from(schema.tabelaQuadro)
    .where(eq(schema.tabelaQuadro.titulo, TITULO_QUADRO_PADRAO))
    .limit(1);

  if (existente.length > 0) {
    return { quadroId: existente[0].id };
  }

  const [quadro] = await db
    .insert(schema.tabelaQuadro)
    .values({ titulo: TITULO_QUADRO_PADRAO })
    .returning({ id: schema.tabelaQuadro.id });

  const colunas = [
    'Novo contato',
    'Orçamento enviado',
    'Em negociação',
    'Ganho',
    'Perdido',
  ];

  for (let i = 0; i < colunas.length; i++) {
    await db.insert(schema.tabelaColuna).values({
      quadroId: quadro.id,
      titulo: colunas[i],
      ordemPosicao: i,
    });
  }

  const produtos = [
    { nome: 'Festa infantil', codigoSku: 'EVT-INF', precoReferenciaBrlCentavos: 1500000 },
    { nome: 'Evento corporativo', codigoSku: 'EVT-CORP', precoReferenciaBrlCentavos: 3500000 },
    { nome: 'Pacote boliche', codigoSku: 'BOL-PAC', precoReferenciaBrlCentavos: 80000 },
    { nome: 'Jantar restaurante', codigoSku: 'REST-JNT', precoReferenciaBrlCentavos: 12000 },
  ];

  await db.insert(schema.tabelaProduto).values(produtos);

  return { quadroId: quadro.id };
}
