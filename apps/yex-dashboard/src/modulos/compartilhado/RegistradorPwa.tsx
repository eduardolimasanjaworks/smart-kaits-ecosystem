"use client";

import { useEffect } from "react";

export default function RegistradorPwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
          console.error("Erro ao registrar o Service Worker do PWA", err);
        });
      });
    }
  }, []);

  return null;
}
