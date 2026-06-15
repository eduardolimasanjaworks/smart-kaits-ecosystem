// Configuração do Next.js: metadados PWA e otimizações padrão do painel executivo.
import type { NextConfig } from "next";

const destinoCrm =
  process.env.CRM_API_INTERNAL_URL?.replace(/\/$/, "") ?? "http://yex-crm-api:4001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/crm/:path*",
        destination: `${destinoCrm}/:path*`,
      },
    ];
  },
};

export default nextConfig;
