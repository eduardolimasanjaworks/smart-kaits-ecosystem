// Tratamento global de erros HTTP com resposta JSON e suporte a Zod.
import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import emitirLogEstruturado from '../../infra/log/emitirLogEstruturado.js';

const manipuladorErroGlobal: ErrorHandler = (erro, c) => {
  const rastreamentoId = c.get('rastreamentoId');
  if (erro instanceof ZodError) {
    return c.json(
      {
        erro: 'payload_invalido',
        rastreamentoId,
        detalhes: erro.flatten()
      },
      400
    );
  }
  emitirLogEstruturado({
    nivel: 'ERROR',
    rastreamentoId,
    mensagem: erro instanceof Error ? erro.message : 'erro_desconhecido',
    contexto: { onde: 'manipuladorErroGlobal' }
  });
  return c.json({ erro: 'interno', rastreamentoId }, 500);
};

export default manipuladorErroGlobal;
