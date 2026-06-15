/** Base da API CRM: no navegador usa o mesmo host (proxy /api/crm); no servidor usa rede interna. */
export function urlApiCrm(): string {
  if (typeof window !== "undefined") {
    return "/api/crm";
  }
  const interno = process.env.CRM_API_INTERNAL_URL?.replace(/\/$/, "");
  if (interno) return interno;
  return process.env.NEXT_PUBLIC_CRM_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4001";
}
