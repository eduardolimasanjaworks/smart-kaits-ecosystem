// Enum PostgreSQL do resultado comercial da negociação (funil fechado).
import { pgEnum } from 'drizzle-orm/pg-core';

export const enumResultadoNegociacao = pgEnum('resultado_negociacao', [
  'ABERTA',
  'GANHA',
  'PERDIDA',
  'ARQUIVADA'
]);
