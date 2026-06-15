// Enum PostgreSQL de tipos de evento comercial (telemetria de KPIs).
import { pgEnum } from 'drizzle-orm/pg-core';

export const enumTipoEventoComercial = pgEnum('tipo_evento_comercial', [
  'ORCAMENTO_ENVIADO',
  'CONTATO_REGISTRADO'
]);
