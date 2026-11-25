import { randomToken, sha256 } from '../../lib/crypto';

// Bilhete do pareamento pela conta: o aparelho que vai parear pede um (POST /api/remote/ticket, com a
// sessão dele) e entrega ao computador de casa dentro do pareamento cifrado; o computador troca o
// bilhete pela sessão de quem pediu (POST /api/remote/claim) e guarda o pareamento preso a ela. Tirar
// essa sessão da conta corta o acesso remoto que ela abriu. Na memória (uma instância só), de uso
// único, por 10 minutos: um reinício no meio só faz o aparelho tentar de novo.

const TICKET_MS = 10 * 60_000;
const MAX_TICKETS = 5000;
const MAX_PER_USER = 20;

export type PairTicket = { userId: string; sessionId: string; hostId: string; expiresAt: number };

export class PairTickets {
  private readonly tickets = new Map<string, PairTicket>();

  issue(ticket: Omit<PairTicket, 'expiresAt'>, now = Date.now()): string {
    let mine = 0;
    for (const [key, t] of this.tickets) {
      if (t.expiresAt <= now) this.tickets.delete(key);
      else if (t.userId === ticket.userId) mine++;
    }
    // Passou do teto da pessoa ou do servidor: sai o mais antigo (dela, ou de qualquer um).
    if (mine >= MAX_PER_USER) {
      for (const [key, t] of this.tickets) {
        if (t.userId !== ticket.userId) continue;
        this.tickets.delete(key);
        break;
      }
    }
    if (this.tickets.size >= MAX_TICKETS) this.tickets.delete(this.tickets.keys().next().value!);
    const value = randomToken();
    this.tickets.set(sha256(value), { ...ticket, expiresAt: now + TICKET_MS });
    return value;
  }

  // Usado uma vez só, certo ou errado.
  claim(value: string, now = Date.now()): PairTicket | null {
    const key = sha256(value);
    const ticket = this.tickets.get(key);
    this.tickets.delete(key);
    return ticket && ticket.expiresAt > now ? ticket : null;
  }
}
