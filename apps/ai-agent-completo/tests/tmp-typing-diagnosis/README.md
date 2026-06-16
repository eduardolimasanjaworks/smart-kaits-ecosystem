# Diagnóstico temporário — digitação retrocedendo

**Apagar esta pasta** após validar o fix em produção/dev.

## Matriz manual

| Teste | Passos | Esperado após fix |
|-------|--------|-------------------|
| A | Uma aba, campo Personalidade, digitar rápido 20+ chars | Texto estável |
| B | Duas abas mesma escola, editar em ambas | Sem overwrite entre abas enquanto foco ativo |
| C | Digitar durante autosave (1s) | Últimos caracteres preservados |
| D | Campo equipe/FAQ | Mesmo comportamento |

## Teste automatizado

```bash
node tests/tmp-typing-diagnosis/merge-config.mjs
```

Simula `Object.assign` sobrescrevendo edição local parcial (race WS/autosave).
