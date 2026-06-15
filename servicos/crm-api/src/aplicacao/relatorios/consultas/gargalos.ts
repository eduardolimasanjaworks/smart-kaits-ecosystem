// Coluna com maior tempo médio de permanência (derivado de tempo-por-coluna).
import type { DbRelatorios } from '../tiposDb.js';
import { consultarTempoPorColuna, type LinhaTempoColuna } from './tempoPorColuna.js';

export type ResultadoGargalo = {
  gargaloPrincipal: LinhaTempoColuna | null;
  colunas: LinhaTempoColuna[];
};

type FiltrosGargalo = {
  quadroId?: string;
  inicioUtc?: Date;
  fimExclusiveUtc?: Date;
};

export async function consultarGargalos(
  db: DbRelatorios,
  filtros: FiltrosGargalo = {},
): Promise<ResultadoGargalo> {
  const colunas = await consultarTempoPorColuna(db, filtros);
  if (colunas.length === 0) return { gargaloPrincipal: null, colunas: [] };

  const gargaloPrincipal = colunas.reduce((max, atual) =>
    atual.mediaDias > max.mediaDias ? atual : max,
  );
  return { gargaloPrincipal, colunas };
}
