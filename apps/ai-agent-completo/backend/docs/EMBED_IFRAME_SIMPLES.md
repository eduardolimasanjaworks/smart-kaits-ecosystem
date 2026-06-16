# Embedar o Smart Kaits num iframe (resumo)

## 1. O que o teu site precisa

- URL do **front** do Smart Kaits (ex.: `https://chat.cliente.com`).
- URL da **API** do Smart Kaits (ex.: `https://api.cliente.com`).
- O mesmo segredo `EMBED_TRUST_SECRET` na **tua** app (servidor) e na API Smart Kaits.

## 2. No teu servidor (nunca no JavaScript público)

1. Calcula `ts` = Unix em segundos (UTC).
2. Monta a mensagem `"{school_slug}.{ts}"` em bytes.
3. `sig = HMAC-SHA256(EMBED_TRUST_SECRET, mensagem).hexdigest()` (64 caracteres hex).
4. `POST {API}/api/v1/auth/embed-handshake` com JSON:
   `{"school_slug": "<slug>", "ts": <ts>, "sig": "<sig>"}`.
5. Lê da resposta o campo `access_token` (JWT).

## 3. Iframe no HTML

Define o `src` com o token no **fragmento** (o front do Smart Kaits lê e limpa o hash):

```html
<iframe
  title="Smart Kaits"
  src="https://SEU-FRONT-SMART-KAITS/#access_token=COLE_O_JWT_AQUI"
  style="width:100%;min-height:640px;border:0;"
  allowfullscreen
  allow="fullscreen; microphone; clipboard-read; clipboard-write; display-capture"
></iframe>
```

Substitui `COLE_O_JWT_AQUI` pelo valor devolvido pelo passo 2 (URL-encode se tiveres caracteres especiais; em muitos casos o JWT já é seguro para colar na hash).

Sem `fullscreen` / `microphone` no `allow` **e** sem `Permissions-Policy` na página mãe a delegar ao domínio do Smart Kaits, o browser bloqueia tela cheia e ditado no embed (mensagens tipo *Permissions policy violation*).

## 4. CORS e postMessage

- Na API Smart Kaits: `ALLOWED_ORIGINS` deve incluir a origem do **front** Smart Kaits (e a do portal, se o browser chamar a API).
- No build do front Smart Kaits: `VITE_EMBED_ALLOWED_ORIGINS` com a origem **exata** da página mãe, se usares `postMessage` em vez do hash.

## 5. Bearer da API Kaits (hospedeiro)

Além do JWT no hash, o portal pode enviar `postMessage` com `{ type: 'SMART_KAITS_KAITS_HOST_BEARER', token: '...' }` para o Smart Kaits guardar e usar em `kaitsPortalFetch()` (com `VITE_KAITS_PORTAL_API_URL`). Ver **`INTEGRACAO_EMBED_PORTAL.md`** secção I.

Documentação completa: `INTEGRACAO_EMBED_PORTAL.md`.
