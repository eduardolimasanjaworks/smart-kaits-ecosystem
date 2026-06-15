// Gera código no formato L+N+L+N+especial+L+N+L (ex.: A3K7@M2P).
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMEROS = "23456789";
const ESPECIAIS = "!@#$%&*";

function sortear(base: string) {
  return base[Math.floor(Math.random() * base.length)];
}

export function gerarCodigoCupom(): string {
  return (
    sortear(LETRAS) +
    sortear(NUMEROS) +
    sortear(LETRAS) +
    sortear(NUMEROS) +
    sortear(ESPECIAIS) +
    sortear(LETRAS) +
    sortear(NUMEROS) +
    sortear(LETRAS)
  );
}

export const PADRAO_CODIGO_CUPOM = /^[A-Z][0-9][A-Z][0-9][!@#$%&*][A-Z][0-9][A-Z]$/;
