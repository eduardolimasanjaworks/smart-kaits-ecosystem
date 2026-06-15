# Smart Kaits — integração no KAITS via iframe (produção)

Documento para a equipe que mantém o **sistema KAITS** (`sistema.kaits.com.br` ou ambiente interno equivalente). O objetivo é embarcar o **aplicativo real** do Smart Kaits em um **modal com iframe**, no mesmo padrão já validado na demonstração estática.

---

## O que é o quê (evitar confusão)

| Papel | Pasta no repositório | O que mostra |
|--------|----------------------|--------------|
| **Demonstração (mock)** | `apps/mock-kaits-demonstracao/` | Cópia estática de telas do KAITS só para simular o menu; **não** é o produto final. |
| **Aplicação a colocar no iframe** | `apps/ai-agent-completo/` | Frontend **Vue 3 + Vite** (e API em FastAPI) — **este** é o que deve carregar dentro do `iframe` em produção. |

A demonstração prova o fluxo: menu do KAITS → clique em “Smart Kaits” → overlay em tela cheia → `iframe` apontando para a URL pública do agente. Na integração de verdade, trocam-se apenas a **origem do HTML/JS** (código do KAITS) e, se necessário, a **URL** — o **mecanismo (overlay + `openSmartKaitsIframe`)** permanece o mesmo.

---

## URL pública a usar no `iframe` (produção atual do ecossistema)

- **Base do app (frontend):** `https://aiagent.sanjaworks.com/`
- **Sugestão (cache / atualização):** anexar um parâmetro de “cache bust” na carga, como na demonstração: `https://aiagent.sanjaworks.com/?v=` + timestamp (ou versão de deploy).

> Se no futuro o deploy usar outro domínio, basta trocar essa string em `iframe.src`; o restante do script não muda.

---

## Referência da implementação já testada (demonstração)

A implementação de referência vive no mock:

- Arquivo: `apps/mock-kaits-demonstracao/index.html`
- Função JavaScript: `openSmartKaitsIframe`
- Gatilho: itens de menu “Smart Kaits” e “Conversas” que chamam `openSmartKaitsIframe(event)` e `openChatwootConversasIframe(event)`.
- A demonstração de produção usa `https://aiagent.sanjaworks.com/?v=` + `Date.now()` no `src` do iframe do agente, e `https://chat.techfala.com.br/?v=` + timestamp no iframe do painel de conversas (Chatwoot).

### Onde inserir no `ul id="topoMenu"` (antes de `sair`)

Colar **após** o bloco do menu “financeiro” (ou equivalente) e **antes** do `<li class="sair">`:

```html
        <li class="sub" style="width: 12%">
          <a
            class="imgTopoMenu"
            style="cursor: pointer; color: rgb(0, 0, 0); display: flex; align-items: center; justify-content: center; height: 1.5em; padding: 0 10px; transition: none; font-family: inherit; font-size: 1em; font-weight: normal; background-color: transparent;"
            onmouseover="this.style.backgroundColor='#6069A2'; this.style.color='#FFF';"
            onmouseout="this.style.backgroundColor='transparent'; this.style.color='#000';"
            onclick="openSmartKaitsIframe(event)"
            ><span>Smart Kaits</span></a
          >
        </li>
        <li class="sub" style="width: 12%">
          <a
            class="imgTopoMenu"
            style="cursor: pointer; color: rgb(0, 0, 0); display: flex; align-items: center; justify-content: center; height: 1.5em; padding: 0 10px; transition: none; font-family: inherit; font-size: 1em; font-weight: normal; background-color: transparent;"
            onmouseover="this.style.backgroundColor='#2ab1bb'; this.style.color='#FFF';"
            onmouseout="this.style.backgroundColor='transparent'; this.style.color='#000';"
            onclick="openChatwootConversasIframe(event)"
            ><span>Conversas</span></a
          >
        </li>
```

> Ajuste o `width` (ex.: `10%` / `12%` / `15%`) conforme a função `ajustaLargura()` do menu do KAITS, para os itens não quebrarem linha.

O segundo script (`openChatwootConversasIframe`) está no mesmo `index.html` da demonstração; a lógica é a mesma do Smart Kaits, mudando o `id` do overlay, as mensagens de confirmação e o `iframe.src` para o host do Chatwoot.

---

## O que a equipe KAITS precisa fazer (sem depender do nosso backend)

1. **Garantir pontos de clique** (itens de menu, botões) para `openSmartKaitsIframe` e, se usarem o painel de conversas no KAITS, `openChatwootConversasIframe` (mesma ideia, URL do Chatwoot no `src`).
2. **Incluir o script** (global ou na página) que cria o overlay, o botão fechar e o `iframe` com a URL de cada aplicação.
3. **Manter o app servido em HTTPS** no iframe; o portal KAITS também deverá ser HTTPS (é o padrão esperado).

Não é necessário alterar a API do Smart Kaits no lado do KAITS para “abrir o modal”: tudo acontece no front do KAITS + carregamento do front do Smart Kaits.

---

## Script de referência (alinhado à demonstração com confirmação ao sair)

Abaixo está a mesma ideia implementada no `index.html` da demonstração: fechar com botão, clique fora (no overlay) ou tecla **Esc** pede confirmação antes de remover o overlay. Se a política de UX do KAITS for “fechar sem pergunta”, a equipe pode simplificar (remover os `confirm`).

```html
<script>
function openSmartKaitsIframe(e) {
  if (e) e.preventDefault();

  var overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '9999999';
  overlay.id = 'smartKaitsOverlay';

  overlay.onclick = function (event) {
    if (event.target === overlay) {
      if (window.confirm('Tem certeza que deseja sair do Smart Kaits?')) {
        document.body.removeChild(overlay);
      }
    }
  };

  var closeBtn = document.createElement('div');
  closeBtn.innerHTML = '✕ FECHAR (X)';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '15px';
  closeBtn.style.right = '30px';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.fontWeight = 'bold';
  closeBtn.style.padding = '8px 16px';
  closeBtn.style.backgroundColor = '#ff4757';
  closeBtn.style.borderRadius = '20px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = function () {
    if (window.confirm('Tem certeza que deseja sair do Smart Kaits?')) {
      document.body.removeChild(overlay);
    }
  };

  var iframe = document.createElement('iframe');
  iframe.src = 'https://aiagent.sanjaworks.com/?v=' + Date.now();
  iframe.style.position = 'absolute';
  iframe.style.top = '70px';
  iframe.style.left = '5%';
  iframe.style.width = '90%';
  iframe.style.height = 'calc(100% - 100px)';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';

  overlay.appendChild(closeBtn);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  document.addEventListener('keydown', function escListener(ev) {
    if (ev.key === 'Escape') {
      if (document.getElementById('smartKaitsOverlay')) {
        if (window.confirm('Tem certeza que deseja sair do Smart Kaits?')) {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', escListener);
        }
      }
    }
  });
}
</script>
```

**Gatilhos mínimos no menu:** use o bloco HTML com os dois `<li>` na seção anterior, ou links simples com `onclick` apontando para as funções.

---

## Detalhes técnicos para operação e suporte

- **Largura / altura e `z-index`:** o overlay usa `z-index: 9999999` e o iframe ~90% da largura, altura `calc(100% - 100px)`, para caber abaixo do botão fechar — igual à demo. Ajustes finos de `top`/`left` podem ser feitos pelo CSS do KAITS se o cabeçalho real tiver altura diferente.
- **Conteúdo interno do Smart Kaits:** a aplicação `ai-agent-completo` pode, por si só, exibir outro `iframe` (ex.: painel de conversas). Se algo não atualizar, costuma ser cache: o parâmetro `?v=` na URL externa do iframe ajuda.
- **Bloqueio de iframe (segurança):** o servidor do Smart Kaits e o do Chatwoot precisam permitir `iframe` a partir de `sistema.kaits.com.br`. Se o iframe vier vazio, revisar `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` em **`aiagent.sanjaworks.com`** e no host do **Chatwoot** (ex.: `chat.techfala.com.br`), com a origem do KAITS.

---

## Checklist rápido pós-integração

- [ ] “Smart Kaits” abre o overlay e o conteúdo de `https://aiagent.sanjaworks.com/` carrega.
- [ ] “Conversas” (se usado) abre o painel do Chatwoot no overlay.
- [ ] Fechar (botão, fora, Esc) se comporta como combinado.
- [ ] Não há erro de “recusou conectar” / tela em branco por bloqueio de frame (CSP / `X-Frame-Options`).
- [ ] Teste em outro browser ou janela anônima para validar cache.

---

*Documento gerado no ecossistema `smart-kaits-ecosystem`: a demonstração fica em `mock-kaits-demonstracao`, o app em `ai-agent-completo`.*
