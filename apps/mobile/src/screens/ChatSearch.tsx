import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { SearchHit } from '@argus/shared/sessions';
import { tr } from '../i18n';
import type { RecentChat } from '../lib/data';
import { useHost } from '../lib/host';
import { go } from '../lib/router';
import { ago } from '../ui/format';
import { Empty, Row, Section } from '../ui/List';
import { fold } from '../ui/SearchField';

// Busca da aba Conversas, em todos os projetos: pelo título na hora (a lista já está aqui) e pelo
// conteúdo no Argus (a mesma busca da pasta, uma por pasta), um instante depois de parar de digitar.

const MAX_RESULTS = 50;

function useContentSearch(paths: string[], query: string): Map<string, string> | null {
  const { conn } = useHost();
  const [hits, setHits] = useState<Map<string, string> | null>(null);
  const key = paths.join('\n');
  useEffect(() => {
    setHits(null);
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      void Promise.all(key.split('\n').filter(Boolean).map((p) => conn.call('sessions:search', p, q).catch((): SearchHit[] => []))).then((lists) => {
        if (alive) setHits(new Map(lists.flat().map((h) => [h.id, h.snippet])));
      });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [conn, key, query]);
  return hits;
}

export function ChatSearchResults({ query, chats, folderName }: { query: string; chats: RecentChat[]; folderName: (path: string) => string }) {
  const hits = useContentSearch([...new Set(chats.map((c) => c.cwd))].sort(), query);
  const q = fold(query.trim());
  // Primeiro os que batem no título; depois os achados pelo conteúdo, com o trecho.
  const byTitle = chats.filter((c) => fold(c.title).includes(q));
  const titled = new Set(byTitle.map((c) => c.id));
  const byContent = hits ? chats.filter((c) => hits.has(c.id) && !titled.has(c.id)) : [];
  const results = [...byTitle.map((c) => ({ c, snippet: undefined as string | undefined })), ...byContent.map((c) => ({ c, snippet: hits?.get(c.id) }))].slice(0, MAX_RESULTS);
  const searching = hits === null && query.trim().length >= 2;

  return (
    <Section title={tr('Resultados', 'Results')}>
      {results.map(({ c, snippet }) => (
        <Row
          key={c.id}
          icon={<MessageCircle size={20} className="text-faint" />}
          title={c.title || tr('Sem título', 'Untitled')}
          subtitle={snippet ? `${folderName(c.cwd)} - ${snippet}` : folderName(c.cwd)}
          trailing={<span className="text-[12px] text-faint">{ago(c.repliedAt || c.updatedAt)}</span>}
          onClick={() => go({ name: 'chat', cwd: c.cwd, id: c.id })}
        />
      ))}
      {searching && <Empty>{tr('Buscando no conteúdo…', 'Searching the content…')}</Empty>}
      {!results.length && !searching && <Empty>{tr('Nada encontrado.', 'Nothing found.')}</Empty>}
    </Section>
  );
}
