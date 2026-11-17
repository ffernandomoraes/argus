import { memo, useState } from 'react';
import { ChevronRight, File } from 'lucide-react';
import type { TextSearchFile } from '@argus/shared/files';
import type { LineRange } from '../../conversation/fileLinks';
import { LOCALE, tr } from '../../i18n';
import { Marked } from './Marked';

type Props = {
  files: TextSearchFile[]
  // Linha aberta por último ("caminho:linha"): fica marcada na lista.
  active: string | null
  onOpen: (path: string, lines: LineRange) => void
};

// Um arquivo dos resultados: o nome, a pasta apagada e quantas linhas acharam; embaixo, cada linha
// com o termo marcado. Clicar no nome recolhe; numa linha, abre o arquivo nela.
const ResultFile = memo(function ResultFile({ file, active, onOpen }: { file: TextSearchFile; active: string | null; onOpen: Props['onOpen'] }) {
  const [collapsed, setCollapsed] = useState(false);
  const slash = file.path.lastIndexOf('/');
  return (
    <li>
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={file.path}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-1 text-left text-xs text-muted outline-none hover:bg-fill hover:text-text"
      >
        <ChevronRight size={12} className={`shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        <File size={13} className="shrink-0 text-faint" />
        <span className="shrink-0 text-text">{file.path.slice(slash + 1)}</span>
        <span className="min-w-0 flex-1 truncate text-faint">{slash > 0 ? file.path.slice(0, slash) : ''}</span>
        <span className="shrink-0 rounded-md bg-fill px-1.5 text-[11px] text-muted tabular-nums">{file.matches.length}</span>
      </button>
      {!collapsed && (
        <ul>
          {file.matches.map((m) => {
            const id = `${file.path}:${m.line}`;
            return (
              <li key={m.line}>
                <button
                  onClick={() => onOpen(file.path, { start: m.line, end: m.line })}
                  title={tr(`Linha ${m.line}`, `Line ${m.line}`)}
                  className={`flex w-full items-baseline gap-2 rounded-md py-0.5 pr-2 pl-8 text-left text-xs outline-none ${
                    active === id ? 'bg-selection text-white [&_*]:text-white' : 'text-muted hover:bg-fill hover:text-text'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                    <Marked text={m.text} ranges={m.ranges} />
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-faint tabular-nums">{m.line.toLocaleString(LOCALE)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
});

// Resultados da busca no conteúdo, agrupados por arquivo, como no VS Code.
export function SearchResults({ files, active, onOpen }: Props) {
  return (
    <ul>
      {files.map((f) => (
        <ResultFile key={f.path} file={f} active={active?.startsWith(`${f.path}:`) ? active : null} onOpen={onOpen} />
      ))}
    </ul>
  );
}
