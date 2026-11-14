import type { ReactNode } from 'react';
import { Brain, Check, ChevronRight, ClipboardPaste, Cpu, Gauge, Paperclip, Slash, Workflow } from 'lucide-react';
import type { ChatSettings } from '@argus/shared/chat';
import type { ClaudeInfo } from '@argus/shared/models';
import { tr } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { COMMANDS, EFFORTS, effortLabel, groupByFamily, MODES } from './options';

// As opções da caixa de escrever, como o rodapé do campo no Argus, em gavetas: o + abre o menu
// (fotos e arquivos, modelo, esforço com Thinking e Ultracode, modo e comandos), e cada item abre
// a sua. O contexto usado
// aparece discreto embaixo da caixa (Composer.tsx).

export type OptionsSheet = 'menu' | 'model' | 'effort' | 'mode' | 'commands' | null;


// Anel do contexto: cheio conforme a janela de contexto da conversa vai sendo usada.
export function ContextRing({ percent, size = 18 }: { percent: number; size?: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--orange)' : 'var(--accent)';
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" className="-rotate-90" aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" />
    </svg>
  );
}

function OptionRow({ selected, onClick, children, danger }: { selected: boolean; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-[12px] text-left last:border-0 active:bg-card-press">
      <span className={`min-w-0 flex-1 ${danger ? 'text-red' : ''}`}>{children}</span>
      {selected && <Check size={18} className="shrink-0 text-accent" />}
    </button>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-1">
      {title && <h3 className="mb-1.5 px-4 text-[12px] tracking-wide text-muted uppercase">{title}</h3>}
      <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">{children}</div>
    </section>
  );
}

function MenuRow({ icon, label, value, onClick, danger }: { icon: ReactNode; label: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-[13px] text-left last:border-0 active:bg-card-press">
      <span className="flex w-6 shrink-0 justify-center text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      {value && <span className={`max-w-[55%] truncate text-[14px] ${danger ? 'text-red' : 'text-muted'}`}>{value}</span>}
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </button>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${on ? 'bg-green' : 'bg-code'}`}
    >
      <span className={`absolute top-[2px] size-[22px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[20px]' : 'left-[2px]'}`} />
    </button>
  );
}

// "Opus 5.5 - Alto": o modelo em vigor (o padrão mostra a que ele aponta) e o esforço, quando o
// modelo tem. Sem a lista da conta ainda, o valor guardado ou "Padrão".
export function modelSummary(settings: ChatSettings, info: ClaudeInfo | null): string {
  const models = info?.models ?? [];
  const current = models.find((m) => m.value === settings.model) ?? models.find((m) => m.value === '');
  const name = current ? (current.value === '' ? (current.resolvedName ?? tr('Padrão', 'Default')) : current.displayName) : settings.model || tr('Padrão', 'Default');
  const hasEffort = current ? current.efforts.length > 0 : true;
  return hasEffort ? `${name} - ${effortLabel(settings.effort)}` : name;
}

export function ComposerOptions({
  open,
  onOpen,
  onAttach,
  onPaste,
  settings,
  info,
  agentChat,
  onChange,
  onCommand,
}: {
  open: OptionsSheet
  onOpen: (sheet: OptionsSheet) => void
  // "Fotos e arquivos": abre o seletor do sistema.
  onAttach: () => void
  // "Colar": imagem, arquivo ou texto copiado. Sem isto (navegador que não lê), a linha some.
  onPaste?: () => void
  settings: ChatSettings
  // Modelos e modo padrão da conta da conversa (chegam alguns segundos depois de o Argus abrir).
  info: ClaudeInfo | null
  // Conversa de outro agente: thinking e Ultracode são do Claude Code, não aparecem.
  agentChat: boolean
  onChange: (patch: Partial<ChatSettings>) => void
  onCommand: (name: (typeof COMMANDS)[number]['name']) => void
}) {
  const close = () => onOpen(null);
  const setOpen = onOpen;
  const models = info?.models ?? [];
  // Modelo guardado que a conta não tem: vale o padrão dela.
  const current = models.find((m) => m.value === settings.model) ?? models.find((m) => m.value === '');
  const modelName = current ? (current.value === '' ? (current.resolvedName ?? tr('Padrão', 'Default')) : current.displayName) : settings.model || tr('Padrão', 'Default');
  const allowed = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS;
  const effective = settings.permissionMode || info?.defaultPermissionMode || 'manual';
  const mode = MODES.find((m) => m.value === effective) ?? MODES[0];
  const ModeIcon = mode.icon;
  const defaultModel = models.find((m) => m.value === '');

  return (
    <>
      <Sheet open={open === 'menu'} onClose={close}>
        <Group>
          <MenuRow
            icon={<Paperclip size={20} />}
            label={tr('Fotos e arquivos', 'Photos and files')}
            onClick={() => {
              close();
              onAttach();
            }}
          />
          {onPaste && (
            <MenuRow
              icon={<ClipboardPaste size={20} />}
              label={tr('Colar', 'Paste')}
              onClick={() => {
                // Antes de fechar: a leitura precisa vir direto do toque.
                onPaste();
                close();
              }}
            />
          )}
        </Group>
        <Group>
          <MenuRow icon={<Cpu size={20} />} label={tr('Modelo', 'Model')} value={modelName} onClick={() => setOpen('model')} />
          {/* Esforço, com Thinking e Ultracode dentro. Modelo sem esforço (Haiku) numa conversa de
              outro agente: nada a escolher, a linha some. */}
          {(allowed.length > 0 || !agentChat) && (
            <MenuRow
              icon={<Gauge size={20} />}
              label={tr('Esforço', 'Effort')}
              value={[allowed.length > 0 ? effortLabel(settings.effort) : '', !agentChat && settings.thinking ? 'Thinking' : '', !agentChat && settings.ultracode ? 'Ultracode' : '']
                .filter(Boolean)
                .join(' - ')}
              onClick={() => setOpen('effort')}
            />
          )}
          <MenuRow icon={<ModeIcon size={20} />} label={tr('Modo', 'Mode')} value={mode.label} danger={mode.danger} onClick={() => setOpen('mode')} />
          <MenuRow icon={<Slash size={20} />} label={tr('Comandos', 'Commands')} onClick={() => setOpen('commands')} />
        </Group>
      </Sheet>

      <Sheet open={open === 'model'} onClose={close} title={tr('Modelo', 'Model')}>
        {!info && <p className="py-6 text-center text-[14px] text-muted">{tr('Carregando os modelos da conta…', 'Loading the account models…')}</p>}
        {info && (
          <>
            <Group>
              {defaultModel && (
                <OptionRow selected={(current?.value ?? '') === ''} onClick={() => {
                    onChange({ model: '' });
                    close();
                  }}>
                  <span className="block text-[15px]">{tr('Padrão', 'Default')}</span>
                  {defaultModel.resolvedName && <span className="block text-[12px] text-muted">{defaultModel.resolvedName}</span>}
                </OptionRow>
              )}
            </Group>
            {groupByFamily(models).map(([family, list]) => (
              <Group key={family} title={family}>
                {list.map((m) => (
                  <OptionRow key={m.value} selected={current?.value === m.value} onClick={() => {
                      onChange({ model: m.value });
                      close();
                    }}>
                    <span className="text-[15px]">{m.displayName}</span>
                  </OptionRow>
                ))}
              </Group>
            ))}
          </>
        )}
      </Sheet>

      <Sheet open={open === 'effort'} onClose={close} title={tr('Esforço', 'Effort')}>
        {allowed.length > 0 && (
          <Group>
            {[{ value: '', label: 'Auto' }, ...allowed].map((e) => (
              <OptionRow key={e.value} selected={settings.effort === e.value} onClick={() => onChange({ effort: e.value })}>
                <span className="text-[15px]">{e.label}</span>
              </OptionRow>
            ))}
          </Group>
        )}
        {/* Thinking e Ultracode são do Claude Code: nas conversas de outro agente, não aparecem. */}
        {!agentChat && (
          <Group>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <span className="flex w-6 shrink-0 justify-center text-muted">
                <Brain size={20} />
              </span>
              <span className="flex-1 text-[15px]">Thinking</span>
              <Switch on={settings.thinking} onChange={(thinking) => onChange({ thinking })} />
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex w-6 shrink-0 justify-center text-muted">
                <Workflow size={20} />
              </span>
              <span className="flex-1 text-[15px]">Ultracode</span>
              <Switch on={settings.ultracode} onChange={(ultracode) => onChange({ ultracode })} />
            </div>
          </Group>
        )}
      </Sheet>

      <Sheet open={open === 'mode'} onClose={close} title={tr('Modo', 'Mode')}>
        <Group>
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <OptionRow
                key={m.value}
                selected={effective === m.value}
                danger={m.danger}
                onClick={() => {
                  onChange({ permissionMode: m.value });
                  close();
                }}
              >
                <span className="flex items-start gap-3">
                  <Icon size={18} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-[15px]">
                      {m.label}
                      {m.value === info?.defaultPermissionMode && <span className="text-muted">{tr(' - padrão', ' - default')}</span>}
                    </span>
                    <span className="block text-[12px] leading-snug text-muted">{m.description}</span>
                  </span>
                </span>
              </OptionRow>
            );
          })}
        </Group>
      </Sheet>

      <Sheet open={open === 'commands'} onClose={close} title={tr('Comandos', 'Commands')}>
        <Group>
          {COMMANDS.map((c) => (
            <OptionRow
              key={c.name}
              selected={false}
              onClick={() => {
                close();
                onCommand(c.name);
              }}
            >
              <span className="block font-mono text-[14px]">/{c.name}</span>
              <span className="block text-[12px] leading-snug text-muted">{c.description}</span>
            </OptionRow>
          ))}
        </Group>
        <p className="mt-3 px-4 text-[12px] leading-snug text-muted">
          {tr('Outros comandos: digite no campo, começando com /.', 'Other commands: type them in the field, starting with /.')}
        </p>
      </Sheet>
    </>
  );
}
