# documents/ — Domínio: Documentos de Treinamento da I.A.

Gerencia o upload de documentos (PDF, DOCX, TXT) que serão usados como
base de conhecimento da I.A. via RAG (Retrieval Augmented Generation).

## Fase Atual (Fase 1): Apenas Metadados

Salva apenas **nome, extensão, tamanho e caminho** do arquivo.
O conteúdo vetorizado é trabalho da **Fase 2** (ver ARCHITECTURE.md ADR-005).

## Endpoints

```
POST   /api/v1/me/documents         → Upload de um ou mais arquivos
GET    /api/v1/me/documents         → Lista documentos da escola
PATCH  /api/v1/me/documents/{id}    → Renomear documento
DELETE /api/v1/me/documents/{id}    → Remover documento
```

## Limites

- Máximo `MAX_UPLOAD_MB` por arquivo (configurável no .env)
- Tipos aceitos: `.pdf`, `.docx`, `.doc`, `.txt`
- Armazenados em `backend/uploads/{school_id}/`
