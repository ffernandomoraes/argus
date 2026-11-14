import { LOCALE, tr } from '../i18n';

// Há quanto tempo, por extenso: "agora", "há 5 minutos", "há 2 horas", "há 3 dias", "há 2 semanas",
// "há 4 meses", "há 1 ano".
export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const min = Math.floor((now - t) / 60_000);
  const say = (n: number, pt: [string, string], en: [string, string]) =>
    tr(`há ${n} ${n === 1 ? pt[0] : pt[1]}`, `${n} ${n === 1 ? en[0] : en[1]} ago`);
  if (min < 1) return tr('agora', 'now');
  if (min < 60) return say(min, ['minuto', 'minutos'], ['minute', 'minutes']);
  const h = Math.floor(min / 60);
  if (h < 24) return say(h, ['hora', 'horas'], ['hour', 'hours']);
  const d = Math.floor(h / 24);
  if (d < 7) return say(d, ['dia', 'dias'], ['day', 'days']);
  if (d < 30) return say(Math.floor(d / 7), ['semana', 'semanas'], ['week', 'weeks']);
  if (d < 365) return say(Math.floor(d / 30), ['mês', 'meses'], ['month', 'months']);
  return say(Math.floor(d / 365), ['ano', 'anos'], ['year', 'years']);
}

// Tempo até uma hora futura: "em 2 h 10 min", "em 3 dias".
export function until(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const ms = Date.parse(iso) - now;
  if (Number.isNaN(ms) || ms <= 0) return '';
  const min = Math.round(ms / 60_000);
  if (min < 60) return tr(`em ${min} min`, `in ${min} min`);
  const h = Math.floor(min / 60);
  if (h < 24) return tr(`em ${h} h ${min % 60} min`, `in ${h} h ${min % 60} min`);
  const d = Math.round(h / 24);
  return tr(`em ${d} ${d === 1 ? 'dia' : 'dias'}`, `in ${d} ${d === 1 ? 'day' : 'days'}`);
}

export const baseName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export function elapsed(since: number | undefined, now = Date.now()): string {
  if (!since) return '';
  const s = Math.max(0, Math.round((now - since) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

// Grupo de data de uma conversa, como nas listas do iOS: "Hoje", "Ontem", "Últimos 7 dias",
// "Últimos 30 dias" e, antes disso, o mês ("Outubro de 2026"). Conta em dias do calendário.
export function dateGroup(iso: string | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return tr('Mais antigas', 'Older');
  const day = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(t)) / 86_400_000);
  if (days <= 0) return tr('Hoje', 'Today');
  if (days === 1) return tr('Ontem', 'Yesterday');
  if (days < 7) return tr('Últimos 7 dias', 'Previous 7 days');
  if (days < 30) return tr('Últimos 30 dias', 'Previous 30 days');
  const month = new Date(t).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

// Dia de uma conversa, um grupo por dia (a aba Conversas): "Hoje", "Ontem", o dia da semana com a
// data nos últimos 7 dias ("Quarta-feira, 12 de nov."), e a data antes disso ("3 de novembro", com
// o ano se for de outro). Conta em dias do calendário.
export function dayGroup(iso: string | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return tr('Mais antigas', 'Older');
  const day = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(t)) / 86_400_000);
  if (days <= 0) return tr('Hoje', 'Today');
  if (days === 1) return tr('Ontem', 'Yesterday');
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const text =
    days < 7
      ? d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' })
      : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Hora de uma mensagem: "14:32" hoje, "ontem 14:32", "12/11 14:32" antes disso.
export function messageTime(iso: string | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (days <= 0) return time;
  if (days === 1) return tr(`ontem ${time}`, `yesterday ${time}`);
  return `${d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' })} ${time}`;
}

// Como o Argus (apps/desktop/src/renderer/src/conversation/format.ts): "45s", "3min 05s", "1h 02min".
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
}

const THOUSANDS = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
export function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`;
  return tr(`${THOUSANDS.format(n / 1000)} mil tokens`, `${THOUSANDS.format(n / 1000)}k tokens`);
}
