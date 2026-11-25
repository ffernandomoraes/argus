import type { ErrorRequestHandler, RequestHandler } from 'express';

import { HttpError, notFound } from '../errors';

// Toda resposta de erro sai como { error: { code, message } }. O app do computador olha só o status
// (401: a sessão acabou). Padrão do codes-modules.

export const apiNotFound: RequestHandler = () => {
  throw notFound('Rota não encontrada.');
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  const bodyError = err as { type?: string } | null;
  if (bodyError?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_request', message: 'O corpo da requisição não é um JSON válido.' } });
    return;
  }
  if (bodyError?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'too_large', message: 'O conteúdo enviado é grande demais.' } });
    return;
  }
  console.error('[account] Erro não tratado:', err);
  res.status(500).json({ error: { code: 'internal', message: 'Algo deu errado. Tente de novo.' } });
};
