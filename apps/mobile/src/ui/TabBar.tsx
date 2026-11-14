import { useEffect, useState, type ReactNode } from 'react';
import { Folder, MessageCircle, UserRound } from 'lucide-react';
import { tr } from '../i18n';
import { replace, type Route } from '../lib/router';

// Navegação de baixo, flutuando como a caixa de escrever: Conversas, Projetos e Conta. Aparece só
// nessas três telas; dentro de uma pasta ou conversa, some (lá embaixo fica a caixa de escrever).
// Trocar de aba não cria volta no histórico, como no iOS.

export type Tab = 'home' | 'projects' | 'settings';

const TABS: { tab: Tab; label: () => string; icon: typeof Folder }[] = [
  { tab: 'home', label: () => tr('Conversas', 'Chats'), icon: MessageCircle },
  { tab: 'projects', label: () => tr('Projetos', 'Projects'), icon: Folder },
  { tab: 'settings', label: () => tr('Conta', 'Account'), icon: UserRound },
];

export const isTab = (route: Route): route is Route & { name: Tab } => TABS.some((t) => t.tab === route.name);

export function TabBar({ current }: { current: Tab }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      {/* O conteúdo some suave atrás da barra, em vez de cortar seco. */}
      <div className="h-6 bg-gradient-to-b from-transparent to-bg" />
      <div className="px-safe bg-bg pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-[340px] rounded-full border border-line bg-card p-0.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)]">
          {TABS.map(({ tab, label, icon: Icon }) => {
            const on = tab === current;
            return (
              <button
                key={tab}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => !on && replace({ name: tab })}
                className={`flex flex-1 flex-col items-center gap-px rounded-full py-1 text-[11px] font-medium active:opacity-60 ${on ? 'bg-code text-accent' : 'text-muted'}`}
              >
                <Icon size={17} strokeWidth={on ? 2.4 : 2} />
                {label()}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Topo das telas das abas, fixo enquanto a lista rola por baixo: título grande, uma linha pequena
// embaixo (o computador, por exemplo) e o que a aba põe junto (busca, etiquetas de workspace). Na
// mesma margem dos cartões da lista, e o conteúdo some num degradê ao passar por baixo.
// O degradê só com a lista rolada: parada no topo, ele cobria o começo do primeiro grupo.
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const check = () => setScrolled(window.scrollY > 0);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);
  return scrolled;
}

// action: botão à direita do título (o + de Projetos).
export function TabHeader({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  const scrolled = useScrolled();
  return (
    <header className="sticky top-0 z-20 bg-bg pt-safe">
      <div className="pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 text-[26px] leading-none font-bold tracking-tight">{title}</h1>
          {action}
        </div>
        {subtitle && <div className="mt-1.5 truncate text-[14px] text-muted">{subtitle}</div>}
        {children}
      </div>
      {scrolled && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-5 bg-gradient-to-b from-bg to-transparent" />}
    </header>
  );
}
