# Clear Strike Dashboard (painel)

PWA Next.js com grade Bento, modo TV e rota de API para KPIs (`/api/metricas`).

## Pré-requisitos

- Node.js 20+ e npm no PATH.

## Como rodar

```bash
cd painel
npm install
npm run dev
```

Abra `http://localhost:3000`. O modo TV está em `/modo-tv`.

## Testes e lint

```bash
npm test
npm run lint
```

## Variáveis de ambiente

Crie `.env.local` (opcional):

- `USAR_HTTP_KPI=1` — usa `KpiRepositorioHttp` em vez do mock em memória.
- `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000` — base para o cliente HTTP chamar `/api/metricas`.

## Gitmoji nos commits

Use títulos como `:sparkles: feat(painel): descrever mudança` com corpo explicando o porquê.
