import { NextResponse } from "next/server";

const CHAVE_AUTH = "yex_auth";
const CHAVE_PERFIL = "yex_role";

export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  const limpar = { httpOnly: true, path: "/", maxAge: 0 };
  resposta.cookies.set(CHAVE_AUTH, "", limpar);
  resposta.cookies.set(CHAVE_PERFIL, "", limpar);
  return resposta;
}
