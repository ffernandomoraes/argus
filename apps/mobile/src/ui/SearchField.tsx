import { Search, XCircle } from 'lucide-react';
import { tr } from '../i18n';

// Campo de busca das listas de conversas, com o X para limpar.
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="mt-4 flex items-center gap-2 rounded-[12px] bg-code px-3 py-2">
      <Search size={18} className="shrink-0 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        enterKeyHint="search"
        placeholder={placeholder ?? tr('Buscar conversas', 'Search chats')}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label={tr('Limpar', 'Clear')} onClick={() => onChange('')} className="shrink-0 text-faint">
          <XCircle size={18} className="fill-faint text-bg" />
        </button>
      )}
    </label>
  );
}

// Sem acento nem maiúscula, para comparar ("Gestão" acha "gestao").
export const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
