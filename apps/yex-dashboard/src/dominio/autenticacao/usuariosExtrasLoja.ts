// Persistência simples de usuários extras (admin CRUD). Sem e-mail transacional.
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { PerfilUsuario } from "./validarCredenciais";
import type { UsuarioAutenticado } from "./validarCredenciais";

export type UsuarioExtraRegistro = {
  id: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
};

const nomeArquivo = "yex-usuarios.json";

function caminhoArquivo() {
  return path.join(process.cwd(), "data", nomeArquivo);
}

async function garantirPasta() {
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
}

async function lerArquivo(): Promise<{ usuarios: UsuarioExtraRegistro[] }> {
  try {
    const raw = await readFile(caminhoArquivo(), "utf-8");
    const j = JSON.parse(raw) as { usuarios?: UsuarioExtraRegistro[] };
    return { usuarios: Array.isArray(j.usuarios) ? j.usuarios : [] };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { usuarios: [] };
    throw e;
  }
}

async function gravarArquivo(dados: { usuarios: UsuarioExtraRegistro[] }) {
  await garantirPasta();
  await writeFile(caminhoArquivo(), JSON.stringify(dados, null, 2), "utf-8");
}

export async function autenticarUsuarioExtra(email: string, senha: string): Promise<UsuarioAutenticado | null> {
  const normalizado = email.trim().toLowerCase();
  const { usuarios } = await lerArquivo();
  const u = usuarios.find((x) => x.email === normalizado && x.senha === senha);
  if (!u) return null;
  return { email: u.email, perfil: u.perfil };
}

export async function listarUsuariosExtrasSemSenha() {
  const { usuarios } = await lerArquivo();
  return usuarios.map(({ id, email, perfil }) => ({ id, email, perfil }));
}

export async function criarUsuarioExtra(input: { email: string; senha: string; perfil: PerfilUsuario }) {
  const email = input.email.trim().toLowerCase();
  const dados = await lerArquivo();
  if (dados.usuarios.some((u) => u.email === email)) {
    return { ok: false as const, erro: "E-mail já cadastrado." };
  }
  const novo: UsuarioExtraRegistro = {
    id: randomUUID(),
    email,
    senha: input.senha,
    perfil: input.perfil,
  };
  dados.usuarios.push(novo);
  await gravarArquivo(dados);
  return { ok: true as const, usuario: { id: novo.id, email: novo.email, perfil: novo.perfil } };
}

export async function atualizarUsuarioExtra(
  id: string,
  patch: { senha?: string; perfil?: PerfilUsuario },
): Promise<{ ok: true; usuario: { id: string; email: string; perfil: PerfilUsuario } } | { ok: false; erro: string }> {
  const dados = await lerArquivo();
  const i = dados.usuarios.findIndex((u) => u.id === id);
  if (i < 0) return { ok: false, erro: "Usuário não encontrado." };
  const atual = dados.usuarios[i]!;
  if (patch.senha !== undefined) atual.senha = patch.senha;
  if (patch.perfil !== undefined) atual.perfil = patch.perfil;
  await gravarArquivo(dados);
  return { ok: true, usuario: { id: atual.id, email: atual.email, perfil: atual.perfil } };
}

export async function excluirUsuarioExtra(id: string): Promise<boolean> {
  const dados = await lerArquivo();
  const filtrados = dados.usuarios.filter((u) => u.id !== id);
  if (filtrados.length === dados.usuarios.length) return false;
  await gravarArquivo({ usuarios: filtrados });
  return true;
}
