// Shell raiz do PWA: metadados de instalação, fontes e fundo noturno da marca Clear Strike.
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import FundoAplicacao from "@/modulos/compartilhado/FundoAplicacao";
import RegistradorPwa from "@/modulos/compartilhado/RegistradorPwa";
import "./globals.css";

const fonteSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const fonteMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Yex Dashboard",
  description: "Inteligência de Negócio — Yex Boliche & Steak House",
  manifest: "/manifest.webmanifest",
  appleWebApp: { 
    capable: true, 
    title: "Yex", 
    statusBarStyle: "black-translucent" 
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteSans.variable} ${fonteMono.variable}`}>
      <body className="font-sans overflow-hidden select-none" suppressHydrationWarning>
        <RegistradorPwa />
        <FundoAplicacao />
        {children}
      </body>
    </html>
  );
}
