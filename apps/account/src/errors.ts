// Erros que viram resposta JSON (ver middlewares/errorHandler.ts). Padrão do codes-modules.

export type ApiErrorCode = 'bad_request' | 'unauthorized' | 'not_found' | 'too_large' | 'rate_limited' | 'unavailable' | 'internal';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const unauthorized = (message = 'Entre na sua conta para continuar.') => new HttpError(401, 'unauthorized', message);
export const notFound = (message = 'Não encontrado.') => new HttpError(404, 'not_found', message);
export const tooLarge = (message: string) => new HttpError(413, 'too_large', message);
export const tooManyRequests = (message = 'Muitas tentativas seguidas. Espere um pouco e tente de novo.') =>
  new HttpError(429, 'rate_limited', message);
export const serviceUnavailable = (message: string) => new HttpError(503, 'unavailable', message);
