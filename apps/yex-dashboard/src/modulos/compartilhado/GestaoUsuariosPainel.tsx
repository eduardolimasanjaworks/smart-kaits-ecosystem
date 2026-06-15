"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import type { PerfilUsuario } from "@/dominio/autenticacao/validarCredenciais";

type UsuarioLista = { id: string; email: string; perfil: PerfilUsuario };

export default function GestaoUsuariosPainel() {
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [emailNovo, setEmailNovo] = useState("");
  const [senhaNovo, setSenhaNovo] = useState("");
  const [perfilNovo, setPerfilNovo] = useState<PerfilUsuario>("comercial");
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/usuarios", { credentials: "same-origin" });
      if (!r.ok) {
        setErro(r.status === 403 ? "Sem permissão." : "Falha ao listar usuários.");
        return;
      }
      const j = (await r.json()) as { usuarios?: UsuarioLista[] };
      setUsuarios(Array.isArray(j.usuarios) ? j.usuarios : []);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setCriando(true);
    setErro(null);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: emailNovo.trim(),
          senha: senhaNovo,
          perfil: perfilNovo,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(j.erro ?? "Não foi possível criar.");
        return;
      }
      setEmailNovo("");
      setSenhaNovo("");
      await carregar();
    } finally {
      setCriando(false);
    }
  };

  const trocarSenha = async (id: string) => {
    const nova = window.prompt("Nova senha (mín. 4 caracteres):");
    if (nova == null || nova.length < 4) return;
    const r = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ senha: nova }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      alert(j.erro ?? "Falha ao atualizar senha.");
      return;
    }
    await carregar();
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Remover este usuário da lista dinâmica?")) return;
    const r = await fetch(`/api/usuarios/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (!r.ok) {
      alert("Não foi possível excluir.");
      return;
    }
    await carregar();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-black text-texto-principal">Usuários do painel</h1>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
        Contas criadas aqui ficam em arquivo no servidor. As contas fixas do ambiente (variáveis{" "}
        <code className="rounded bg-fundo-profundo px-1 text-xs">YEX_*</code>) continuam válidas e não aparecem
        nesta lista. Nenhum e-mail é enviado.
      </p>

      {erro ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p> : null}

      <form
        onSubmit={(e) => void criar(e)}
        className="mt-8 space-y-4 rounded-2xl border border-borda-sutil bg-white p-6 shadow-cartao"
      >
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-900">
          <UserPlus className="h-4 w-4 text-[#FF6B00]" aria-hidden />
          Novo usuário
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-800">
            E-mail (login)
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-borda-sutil px-3 py-2 text-sm"
              value={emailNovo}
              onChange={(e) => setEmailNovo(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-bold text-slate-800">
            Senha inicial
            <input
              type="password"
              required
              minLength={4}
              className="mt-1 w-full rounded-lg border border-borda-sutil px-3 py-2 text-sm"
              value={senhaNovo}
              onChange={(e) => setSenhaNovo(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        <label className="block text-xs font-bold text-slate-800">
          Perfil
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-borda-sutil px-3 py-2 text-sm"
            value={perfilNovo}
            onChange={(e) => setPerfilNovo(e.target.value as PerfilUsuario)}
          >
            <option value="comercial">Comercial</option>
            <option value="operacao">Operação</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={criando}
          className="rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {criando ? "Salvando…" : "Criar usuário"}
        </button>
      </form>

      <div className="mt-10 rounded-2xl border border-borda-sutil bg-white shadow-cartao">
        <div className="border-b border-borda-sutil px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Cadastrados (arquivo)</h2>
        </div>
        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
          </div>
        ) : usuarios.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">Nenhum usuário extra ainda.</p>
        ) : (
          <ul className="divide-y divide-borda-sutil">
            {usuarios.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-texto-principal">{u.email}</p>
                  <p className="text-xs font-bold uppercase text-slate-500">{u.perfil}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void trocarSenha(u.id)}
                    className="rounded-lg border border-borda-sutil px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-fundo-profundo"
                  >
                    Nova senha
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluir(u.id)}
                    className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                    aria-label={`Excluir ${u.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
