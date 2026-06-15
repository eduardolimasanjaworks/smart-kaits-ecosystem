import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import type { PerfilUsuario } from "@/dominio/autenticacao/validarCredenciais";
import { atualizarUsuarioExtra, excluirUsuarioExtra } from "@/dominio/autenticacao/usuariosExtrasLoja";

async function exigeAdmin() {
  const jar = await cookies();
  if (jar.get("yex_role")?.value !== "admin") {
    return NextResponse.json({ erro: "Acesso restrito a administradores." }, { status: 403 });
  }
  return null;
}

const esquemaPatch = z
  .object({
    senha: z.string().min(4).max(200).optional(),
    perfil: z.enum(["admin", "comercial", "operacao"]).optional(),
  })
  .refine((o) => o.senha !== undefined || o.perfil !== undefined, { message: "Nada para atualizar." });

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const bloqueio = await exigeAdmin();
  if (bloqueio) return bloqueio;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ erro: "id inválido" }, { status: 400 });
  }
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = esquemaPatch.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });
  }
  const r = await atualizarUsuarioExtra(id, {
    senha: parsed.data.senha,
    perfil: parsed.data.perfil as PerfilUsuario | undefined,
  });
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 404 });
  return NextResponse.json({ usuario: r.usuario });
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const bloqueio = await exigeAdmin();
  if (bloqueio) return bloqueio;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ erro: "id inválido" }, { status: 400 });
  }
  const ok = await excluirUsuarioExtra(id);
  if (!ok) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
