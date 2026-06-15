export function formatarMoedaCentavos(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarVariacao(variacao: number | null | undefined) {
  if (variacao == null) return { texto: "—", positivo: null as boolean | null };
  const sinal = variacao > 0 ? "+" : "";
  return {
    texto: `${sinal}${variacao}%`,
    positivo: variacao > 0 ? true : variacao < 0 ? false : null,
  };
}

export function rotuloMesCurto(mes: string) {
  const [y, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${y?.slice(2) ?? ""}`;
}
