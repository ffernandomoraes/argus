import { errorMessage } from '../lib/errors'

// Falhas de rede de passagem do Chromium: a rede mudou no meio da consulta (troca de Wi-Fi, VPN
// ligando, Mac acordando do repouso) ou ainda não voltou. Tentar de novo em seguida costuma dar certo.
const TRANSIENT = /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NETWORK_IO_SUSPENDED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|ADDRESS_UNREACHABLE|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_ABORTED|CONNECTION_TIMED_OUT|TIMED_OUT|PROXY_CONNECTION_FAILED)/

// O código net::ERR_... de uma falha de rede passageira, ou '' quando é outra coisa.
export function transientNetError(err: unknown): string {
  return TRANSIENT.exec(errorMessage(err))?.[0] ?? ''
}
