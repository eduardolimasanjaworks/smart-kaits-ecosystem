"use client";

import { LogOut } from "lucide-react";

export default function BotaoLogout() {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
    window.location.href = "/login";
  };

  return (
    <button
      id="btn-logout"
      title="Sair da Conta"
      className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-red-50/80 text-red-600 backdrop-blur-sm transition-colors hover:bg-red-100"
      onClick={logout}
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
