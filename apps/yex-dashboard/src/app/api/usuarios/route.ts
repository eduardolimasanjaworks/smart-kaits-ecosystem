import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import type { PerfilUsuario } from "@/dominio/autenticacao/validarCredenciais";
import { criarUsuarioExtra, listarUsuariosExtrasSemSenha } from "@/dominio/autenticacao/usuariosExtrasLoja";

async function exigeAdmin() {
  const jar = await cookies();
  if (jar.get("yex_role")?.value !== "admin") {
    return NextResponse.json({ erro: "Acesso restrito a administradores." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const bloqueio = await exigeAdmin();
  if (bloqueio) return bloqueio;
  const usuarios = await listarUsuariosExtrasSemSenha();
  return NextResponse.json({ usuarios });
}

const esquemaCriacao = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(4).max(200),
  perfil: z.enum(["admin", "comercial", "operacao"]),
});

export async function POST(request: NextRequest) {
  const bloqueio = await exigeAdmin();
  if (bloqueio) return bloqueio;
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = esquemaCriacao.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });
  }
  const r = await criarUsuarioExtra({
    email: parsed.data.email,
    senha: parsed.data.senha,
    perfil: parsed.data.perfil as PerfilUsuario,
  });
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 409 });
  return NextResponse.json({ usuario: r.usuario }, { status: 201 });
}
