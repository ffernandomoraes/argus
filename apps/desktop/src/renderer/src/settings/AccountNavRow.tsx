import { Avatar } from '../account/Avatar';
import { useAccount } from '../account/useAccount';
import { tr } from '../i18n';

// A conta do Argus no topo da lateral das Configurações, como a Conta Apple no Ajustes do Sistema:
// foto e nome (ou "Entrar"). Abre a seção Perfil.
export function AccountNavRow({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const account = useAccount();
  const profile = account?.status === 'signedIn' ? account.profile : null;
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'page' : undefined}
      className={`mb-6 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left ${selected ? 'bg-selection text-white' : 'hover:bg-fill'}`}
    >
      <Avatar name={profile?.name ?? null} src={profile?.avatar ?? null} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{profile ? profile.name : tr('Entrar', 'Sign in')}</span>
        {/* 13px, abaixo do mínimo de 15px das Configurações: pedido em 2026-11-23, como a legenda da Conta Apple. */}
        <span className={`block truncate text-[13px] ${selected ? 'text-white/80' : 'text-muted'}`}>{tr('Conta do Argus', 'Argus account')}</span>
      </span>
    </button>
  );
}
