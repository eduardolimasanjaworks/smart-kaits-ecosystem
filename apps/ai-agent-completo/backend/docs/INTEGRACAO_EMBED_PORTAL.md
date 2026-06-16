# Integração Kaits (aplicação mãe) → Smart Kaits (iframe)

Objetivo: o utilizador **já autenticado no Kaits** abre o Smart Kaits embutido **sem** voltar a introduzir slug/senha do Smart Kaits. Cada escola mantém **RAG**, **dados** e **WhatsApp (Evolution)** isolados.

---

## O que o Kaits **deve** fazer (resumo operacional)

### A) Resolver a escola no Smart Kaits

- O Kaits precisa de um mapeamento estável: **utilizador / turma / contrato Kaits → `school_slug`** (slug registado no Smart Kaits para essa escola).

### B) Obter o JWT **no servidor Kaits** (nunca no JS público com segredo)

1. No **servidor** Kaits (Node, Python, PHP, etc.), com o mesmo segredo que está em `EMBED_TRUST_SECRET` no backend Smart Kaits:
   - `ts = int(time.time())` (UTC, segundos)
   - `msg = f"{school_slug}.{ts}".encode("utf-8")`
   - `sig = hmac.new(EMBED_TRUST_SECRET.encode(), msg, hashlib.sha256).hexdigest()` (hex **minúsculo**)
2. Chamar **apenas servidor → servidor**:
   ```http
   POST https://<API-SMART-KAITS>/api/v1/auth/embed-handshake
   Content-Type: application/json

   {"school_slug": "<slug>", "ts": <ts>, "sig": "<sig 64 hex>"}
   ```
3. Resposta: `{ "access_token": "<JWT>", "school": { ... } }` — o JWT contém **`school_id`** dessa escola.

### C) Entregar o JWT ao iframe (uma das formas)

| Método | O que fazer |
|--------|-------------|
| **Fragmento na URL do iframe** | `src="https://<smart-kaits>/#access_token=<JWT>"` — o front consome o hash e remove da barra. |
| **`postMessage`** | Na página mãe, após `load` do iframe: `iframe.contentWindow.postMessage({ type: 'SMART_KAITS_AUTH', access_token: jwt }, 'https://<origem-exata-do-smart-kaits>')` |

### D) Configuração no front Smart Kaits (build)

- `VITE_EMBED_ALLOWED_ORIGINS` — lista (vírgula) das **origens exatas** do Kaits que podem enviar `postMessage` (ex.: `https://app.kaits.com.br`).

### E) CORS no backend Smart Kaits

- `ALLOWED_ORIGINS` deve incluir a origem do **front** do Smart Kaits e, se o browser do Kaits chamar a API diretamente, a origem do Kaits.

### F) Segredos

- **`EMBED_TRUST_SECRET`**: só em variáveis de ambiente dos **dois** backends (Kaits + Smart Kaits). **Não** colocar em JavaScript enviado ao browser.

### G) Permissões no iframe (fullscreen, microfone, texto, arquivos)

Sem isto, o browser mostra violações do tipo **`Permissions policy violation: fullscreen is not allowed in this document`** e recursos opcionais (voz, tela cheia) falham **dentro** do Smart Kaits embutido.

#### O que pedir ao dev do Kaits (página **mãe**)

1. **Atributo `allow` no `<iframe>`** (liste a **origem exata** do Smart Kaits; substitua pelo URL real):

```html
<iframe
  src="https://<origem-smart-kaits>/..."
  title="Smart Kaits"
  allowfullscreen
  allow="fullscreen; microphone; clipboard-read; clipboard-write; display-capture"
></iframe>
```

- **`fullscreen`**: botão “tela cheia” / `requestFullscreen` dentro do embed.
- **`microphone`**: ditado por voz no simulador de chat (Web Speech API / gravação).
- **`clipboard-read` / `clipboard-write`**: colar/copiar texto no embed, se usarem APIs de clipboard.
- **`display-capture`**: só se no futuro houver captura de ecrã; pode omitir se não usar.

2. **Cabeçalho HTTP `Permissions-Policy` na página mãe** (ou meta equivalente, conforme stack), **delegando** essas features ao iframe. Exemplo (ajuste origens):

```http
Permissions-Policy: fullscreen=(self "https://<origem-smart-kaits>"), microphone=(self "https://<origem-smart-kaits>"), clipboard-read=(self "https://<origem-smart-kaits>"), clipboard-write=(self "https://<origem-smart-kaits>")
```

Se a política da página mãe for **`fullscreen=()`** (bloqueado por defeito), o filho **nunca** consegue fullscreen, custe o que custar no código do Smart Kaits.

3. **Texto e teclado** — `<input>`, `<textarea>` e envio de mensagens funcionam sem permissão extra, desde que o iframe **não** use `sandbox` sem `allow-forms` / `allow-scripts`.

4. **Subir ficheiros** — `<input type="file">` no embed normalmente funciona sem permissão dedicada; **não** use `sandbox` sem `allow-forms`. Se no Kaits existir CSP restritiva, garanta que não bloqueia `multipart/form-data` para a origem do Smart Kaits.

5. **`sandbox`** — se o Kaits usar iframe com `sandbox`, tem de incluir pelo menos algo como: `allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox` (ajuste à política de segurança interna). Sandbox demasiado restrito quebra chat, uploads e APIs modernas.

Documento curto só com markup: **`EMBED_IFRAME_SIMPLES.md`**.

### H) Terminologia: documento pai vs conteúdo embarcado

| Termo (comum) | Significado |
|---------------|-------------|
| **Documento pai** / **Parent document** | A página que contém a tag `<iframe>` (ex.: portal Kaits). No JS: `window.parent` a partir do filho. |
| **Página hospedeira** / **Host page** | O site “de fora” que reserva o espaço e controla tamanho/posição do iframe. |
| **Conteúdo embarcado** / **Child document** | O que corre **dentro** do iframe (aqui, o front Smart Kaits), outra origem se o domínio for diferente. |
| **Consumidor** (micro-frontends) | O host que incorpora o widget; o Smart Kaits é o serviço embarcado. |

### I) Bearer da API Kaits (além do JWT Smart Kaits)

O JWT obtido por `embed-handshake` autentica o utilizador **no Smart Kaits** (`Authorization: Bearer` nas rotas `/api/v1/...` do nosso backend).

Quando o Smart Kaits precisar chamar a **API REST do Kaits** (dados do portal, matrículas, etc.), o **hospedeiro** pode fornecer **outro** token — tipicamente um Bearer de sessão ou de serviço do Kaits — **independente** do JWT Smart Kaits.

**Recomendado: `postMessage`** (não colocar segredos longos na query string; histórico e referrers expõem URL).

**No documento pai (após o `load` do iframe), com `targetOrigin` = origem exata do front Smart Kaits:**

```js
iframe.addEventListener('load', () => {
  iframe.contentWindow.postMessage(
    {
      type: 'SMART_KAITS_KAITS_HOST_BEARER',
      token: '<Bearer da API Kaits emitido no servidor do portal>',
    },
    'https://<origem-exata-smart-kaits>',
  );
});
```

**No Smart Kaits (já implementado):** a mensagem é aceite se `event.origin` estiver em `VITE_EMBED_ALLOWED_ORIGINS`. O valor é guardado em `localStorage` (`kaits_host_api_bearer`).

**Tipos aceites:** `SMART_KAITS_KAITS_HOST_BEARER` ou `KAITS_HOST_API_BEARER`. Corpo: `token` ou `bearer` (string).

**Alternativa (só dev / legado):** no fragmento da URL do iframe, parâmetros opcionais `kaits_host_bearer` ou `host_kaits_bearer` (menos seguro; visível no endereço).

**Uso no front:** após definir `VITE_KAITS_PORTAL_API_URL` (base da API Kaits), use `kaitsPortalFetch('/caminho', { method: 'GET' })` em `src/services/api.js` — o `Authorization: Bearer` será o token do hospedeiro, **não** o JWT Smart Kaits.

**Logout no Smart Kaits** limpa também o Bearer do hospedeiro.

O **mock** `mock-kaits-demo` envia automaticamente um Bearer de demonstração e configura iframe + `Permissions-Policy` para testar fullscreen e microfone.

---

## Garantias de isolamento (o que “verificamos” por desenho)

| Camada | Isolamento |
|--------|------------|
| **JWT** | Todo tráfego autenticado carrega `school_id` da escola. |
| **Qdrant / RAG** | Filtro por `school_id` em todas as buscas; payloads dos pontos trazem `school_id`. |
| **Postgres** | Documentos, config, etc. por `school_id`. |
| **Evolution** | Instância `sk_<uuid_escola>` + webhook que resolve a escola e chama a I.A. com o mesmo `school_id`. |
| **Vários utilizadores Kaits** | Se partilham a mesma escola, usam o **mesmo** JWT (ou embed que emite JWT para essa escola) — mesmo perfil; membros humanos extra: ver `school_members` e login membro. |

Documento detalhado: **`GARANTIAS_ISOLAMENTO_KAITS.md`**.

---

## Iframe sem token

O Smart Kaits detecta `window.self !== window.top`, **não** inicia sessão sozinho e espera (~12 s) por `#access_token=` / `postMessage`. Se não chegar, mostra a **tela de suporte** com instruções.

## URL direta (sem portal)

Sem token: **tela de login** com **slug + senha da escola** (credenciais fornecidas pela KAITS à escola). Não existe modo “demo” global nem bypass por link anónimo.

---

## WhatsApp — QR e “online”

- O painel chama `GET /api/v1/whatsapp/connect` (com JWT) para criar/reutilizar instância Evolution e obter **QR**.
- O front faz polling a **`GET /api/v1/whatsapp/status`** (ex. cada 30 s) para `connected` / `desconectado` com base no `connectionState` da Evolution (`open` = ligado).

Ver também: **`EVOLUTION_WHATSAPP.md`**.
