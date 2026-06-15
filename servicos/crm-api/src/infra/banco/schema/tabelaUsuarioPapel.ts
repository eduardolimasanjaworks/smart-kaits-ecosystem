// Junção N:N entre usuário e papel (autorização granular futura).
import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { tabelaPapel } from './tabelaPapel.js';
import { tabelaUsuario } from './tabelaUsuario.js';

export const tabelaUsuarioPapel = pgTable(
  'usuario_papel',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => tabelaUsuario.id, { onDelete: 'cascade' }),
    papelId: uuid('papel_id')
      .notNull()
      .references(() => tabelaPapel.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.papelId] })]
);
