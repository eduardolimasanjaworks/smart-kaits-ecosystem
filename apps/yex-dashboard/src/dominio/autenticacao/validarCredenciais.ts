// Validação de credenciais e perfis de acesso do painel Yex.
export type PerfilUsuario = "admin" | "comercial" | "operacao";

export type UsuarioAutenticado = {
  email: string;
  perfil: PerfilUsuario;
};

type Credencial = {
  email: string;
  senha: string;
  perfil: PerfilUsuario;
};

function obterCredenciais(): Credencial[] {
  return [
    {
      email: (process.env.YEX_AUTH_EMAIL ?? "admin@yex.com.br").trim().toLowerCase(),
      senha: process.env.YEX_AUTH_PASSWORD ?? "123456",
      perfil: "admin",
    },
    {
      email: (process.env.YEX_COMERCIAL_EMAIL ?? "comercial@yex.com.br").trim().toLowerCase(),
      senha: process.env.YEX_COMERCIAL_PASSWORD ?? "123456",
      perfil: "comercial",
    },
    {
      email: (process.env.YEX_OPERACAO_EMAIL ?? "operacao@yex.com.br").trim().toLowerCase(),
      senha: process.env.YEX_OPERACAO_PASSWORD ?? "123456",
      perfil: "operacao",
    },
  ];
}

export function validarCredenciais(email: string, senha: string): UsuarioAutenticado | null {
  const normalizado = email.trim().toLowerCase();
  const encontrado = obterCredenciais().find((c) => c.email === normalizado && c.senha === senha);
  if (!encontrado) return null;
  return { email: encontrado.email, perfil: encontrado.perfil };
}
