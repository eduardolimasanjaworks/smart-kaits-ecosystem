import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filtrosPadrao,
  periodoMesAtual,
  type FiltroRelatorio,
} from "./tiposFiltroRelatorio";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

describe("periodoMesAtual", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna primeiro e último dia do mês corrente", () => {
    const { inicio, fim } = periodoMesAtual();
    expect(inicio).toBe("2026-05-01");
    expect(fim).toBe("2026-05-31");
    expect(inicio).toMatch(ISO_DATA);
    expect(fim).toMatch(ISO_DATA);
  });

  it("ajusta fevereiro em ano bissexto", () => {
    vi.setSystemTime(new Date("2024-02-10T12:00:00Z"));
    const { inicio, fim } = periodoMesAtual();
    expect(inicio).toBe("2024-02-01");
    expect(fim).toBe("2024-02-29");
  });
});

describe("filtrosPadrao", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("combina período do mês com tipoData criado", () => {
    const f = filtrosPadrao();
    expect(f.tipoData).toBe("criado");
    expect(f.inicio).toBe("2026-03-01");
    expect(f.fim).toBe("2026-03-31");
  });

  it("satisfaz o tipo FiltroRelatorio sem campos extras", () => {
    const f: FiltroRelatorio = filtrosPadrao();
    expect(f.leadId).toBeUndefined();
    expect(f.quadroId).toBeUndefined();
    expect(f.resultados).toBeUndefined();
  });
});
