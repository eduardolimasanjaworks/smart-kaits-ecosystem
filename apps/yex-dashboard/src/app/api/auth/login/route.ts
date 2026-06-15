import { NextRequest, NextResponse } from "next/server";
import { validarCredenciais } from "@/dominio/autenticacao/validarCredenciais";
import { autenticarUsuarioExtra } from "@/dominio/autenticacao/usuariosExtrasLoja";

const CHAVE_AUTH = "yex_auth";
const CHAVE_PERFIL = "yex_role";

export async function POST(request: NextRequest) {
  let corpo: { email?: string; senha?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const email = corpo.email?.trim().toLowerCase() ?? "";
  const senha = corpo.senha ?? "";

  if (!email || !senha) {
    return NextResponse.json({ erro: "Informe e-mail e senha." }, { status: 400 });
  }

  const usuarioFixo = validarCredenciais(email, senha);
  const usuarioExtra = usuarioFixo ? null : await autenticarUsuarioExtra(email, senha);
  const usuario = usuarioFixo ?? usuarioExtra;
  if (!usuario) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true, perfil: usuario.perfil });
  const https = request.nextUrl.protocol === "https:";
  const opcoes = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: https,
    maxAge: 60 * 60 * 24 * 7,
  };

  resposta.cookies.set(CHAVE_AUTH, "1", opcoes);
  resposta.cookies.set(CHAVE_PERFIL, usuario.perfil, opcoes);

  return resposta;
}
