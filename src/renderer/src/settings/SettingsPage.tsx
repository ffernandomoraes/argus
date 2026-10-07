import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AppWindow,
  MessagesSquare,
  Monitor,
  Moon,
  Palette,
  PanelRight,
  Settings2,
  Sun,
  User,
  X
} from 'lucide-react'
import { EFFORTS, groupByFamily } from '../conversation/ModelEffortPicker'
import { MODES } from '../conversation/PermissionModePicker'
import type { SessionSettings } from '../conversation/SessionSettings'
import { useClaudeInfo } from '../conversation/useModels'
import { LoginPanel } from '../auth/LoginPanel'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import type { CliStatus } from '../../../shared/cli'
import type { ThemePreference } from '../theme/useTheme'
import { Row, Segmented, Select, Switch } from './controls'
import { setPreferences, usePreferences } from './preferences'
import { useUpdates } from '../updates/useUpdates'

type Section = 'general' | 'conversations' | 'appearance' | 'account'

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'general', label: 'Geral', icon: <Settings2 size={15} /> },
  { id: 'conversations', label: 'Conversas', icon: <MessagesSquare size={15} /> },
  { id: 'appearance', label: 'Aparência', icon: <Palette size={15} /> },
  { id: 'account', label: 'Conta', icon: <User size={15} /> }
]

// `argus .` em qualquer terminal abre a pasta no canvas, como o `code .` do VS Code.
function CliRow() {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => void window.api.cli.status().then(setStatus), [])

  const run = async (action: () => Promise<CliStatus>) => {
    setBusy(true)
    setStatus(await action())
    setBusy(false)
  }

  const note = status?.error ?? status?.warning
  return (
    <Row
      label="Comando argus no terminal"
      description={`Digite "argus ." em qualquer terminal para abrir a pasta no canvas. Nos terminais do app ele já funciona sem instalar.${note ? ` ${note}` : ''}`}
    >
      {status && (
        <button
          disabled={busy || !!status.error}
          onClick={() => run(status.installed ? window.api.cli.uninstall : window.api.cli.install)}
          className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
        >
          {status.installed ? 'Remover' : 'Instalar'}
        </button>
      )}
    </Row>
  )
}

// Guardada no processo principal: o ícone é criado antes de a janela abrir.
function MenuBarIconRow() {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => void window.api.settings.get().then((s) => setOn(s.menuBarIcon)), [])

  return (
    <Row
      label="Ícone na barra de menus"
      description="Mostra no topo do macOS quando uma conversa está rodando, precisa de você ou terminou."
    >
      {on !== null && (
        <Switch
          label="Ícone na barra de menus"
          checked={on}
          onChange={(next) => {
            setOn(next)
            void window.api.settings.setMenuBarIcon(next)
          }}
        />
      )}
    </Row>
  )
}

// A conferência automática roda sozinha (ao abrir e a cada 5 horas); aqui dá para forçar.
function UpdatesRow() {
  const updates = useUpdates()
  if (!updates) return null
  const { version, state } = updates

  const status =
    state.status === 'checking' ? 'Procurando versão nova…'
    : state.status === 'latest' ? 'Você está na versão mais recente.'
    : state.status === 'downloading' ? `Baixando a versão ${state.version} - ${Math.round(state.progress * 100)}%.`
    : state.status === 'ready' ? `A versão ${state.version} está pronta: entra ao reiniciar ou quando o app fechar.`
    : state.status === 'error' ? state.message
    : state.status === 'unsupported' ? state.reason
    : 'Procura versão nova ao abrir o app e a cada 5 horas.'
  const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'unsupported'

  return (
    <Row label="Atualizações" description={`Versão ${version}. ${status}`}>
      {state.status === 'ready' ? (
        <button
          onClick={() => window.api.updates.install()}
          className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
        >
          Reiniciar e atualizar
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() => void window.api.updates.check()}
          className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
        >
          Procurar
        </button>
      )}
    </Row>
  )
}

function GeneralSection() {
  const prefs = usePreferences()
  return (
    <>
      <Row label="Abrir conversas em" description="O que acontece ao clicar numa conversa no canvas.">
        <Segmented
          value={prefs.openIn}
          onChange={(openIn) => setPreferences({ openIn })}
          options={[
            { value: 'panel', label: 'Painel lateral', icon: <PanelRight size={13} /> },
            { value: 'window', label: 'Janela separada', icon: <AppWindow size={13} /> }
          ]}
        />
      </Row>
      <MenuBarIconRow />
      <CliRow />
      <UpdatesRow />
    </>
  )
}

function ConversationsSection() {
  const prefs = usePreferences()
  const info = useClaudeInfo()
  const models = info?.models ?? []
  const s = prefs.conversation
  const set = (patch: Partial<SessionSettings>) => setPreferences({ conversation: { ...s, ...patch } })

  const defaultModel = models.find((m) => m.value === '')
  const current = models.find((m) => m.value === s.model)
  const efforts = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS

  return (
    <>
      <p className="mb-2 text-xs leading-relaxed text-faint">
        Como cada conversa abre. Vale para conversas novas e para as que você ainda não ajustou no próprio chat.
      </p>

      <Row label="Modelo">
        <Select value={s.model} onChange={(model) => set({ model })}>
          <option value="">Padrão{defaultModel?.resolvedName ? ` - ${defaultModel.resolvedName}` : ''}</option>
          {groupByFamily(models).map(([family, versions]) => (
            <optgroup key={family} label={family}>
              {versions.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Row>

      <Row
        label="Esforço"
        description={efforts.length ? 'Quanto o modelo pensa antes de agir. Auto deixa o Claude Code decidir.' : 'O modelo escolhido não usa esforço.'}
      >
        {efforts.length > 0 && (
          <Segmented
            value={s.effort}
            onChange={(effort) => set({ effort })}
            options={[{ value: '', label: 'Auto' }, ...efforts.map((e) => ({ value: e.value, label: e.label }))]}
          />
        )}
      </Row>

      <Row label="Modo" description="Quanto o Claude pode fazer sem pedir sua aprovação.">
        <Select value={s.permissionMode} onChange={(permissionMode) => set({ permissionMode })}>
          <option value="">
            Padrão da conta{info ? ` - ${MODES.find((m) => m.value === info.defaultPermissionMode)?.label ?? ''}` : ''}
          </option>
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Row>

      <Row label="Thinking" description="Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas.">
        <Switch label="Thinking" checked={s.thinking} onChange={(thinking) => set({ thinking })} />
      </Row>

      <Row label="Ultracode" description="Usa vários subagentes em paralelo em toda tarefa. Gasta bem mais tokens.">
        <Switch label="Ultracode" checked={s.ultracode} onChange={(ultracode) => set({ ultracode })} />
      </Row>
    </>
  )
}

function AppearanceSection({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  return (
    <Row label="Tema" description="Sistema acompanha o modo claro ou escuro do macOS.">
      <Segmented
        value={theme}
        onChange={onThemeChange}
        options={[
          { value: 'dark', label: 'Escuro', icon: <Moon size={13} /> },
          { value: 'light', label: 'Claro', icon: <Sun size={13} /> },
          { value: 'system', label: 'Sistema', icon: <Monitor size={13} /> }
        ]}
      />
    </Row>
  )
}

const PROVIDERS: Record<string, string> = {
  bedrock: 'Amazon Bedrock',
  vertex: 'Google Vertex AI',
  foundry: 'Microsoft Foundry',
  gateway: 'gateway da empresa'
}

// Conta do Claude Code, a mesma do terminal e do VS Code: entrar, trocar e sair valem para o Mac todo.
function AccountSection() {
  const auth = useAuth()
  const [switching, setSwitching] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const account = auth?.account
  const login = auth?.login

  // Login terminou ou foi cancelado: volta para o resumo da conta.
  const status = login?.status
  const prevStatus = useRef(status)
  useEffect(() => {
    if ((prevStatus.current === 'starting' || prevStatus.current === 'waiting') && status === 'idle') setSwitching(false)
    prevStatus.current = status
  }, [status])

  if (!auth) return <p className="text-xs text-faint">Conferindo a conta…</p>

  if (!account) {
    return (
      <p className="text-xs leading-relaxed text-faint">
        Não deu para conferir a conta: o Claude Code não respondeu. Confira se ele está instalado rodando{' '}
        <code className="font-mono text-muted">claude</code> no Terminal.
      </p>
    )
  }

  const loggingIn = login!.status !== 'idle'
  if (!account.loggedIn || switching || loggingIn) {
    return (
      <div className="max-w-sm">
        {account.loggedIn && (
          <p className="mb-4 text-xs leading-relaxed text-faint">
            Entre com a outra conta. Ela substitui {account.email ?? 'a atual'} no Claude Code deste Mac.
          </p>
        )}
        <LoginPanel login={login!} onCancel={account.loggedIn ? () => setSwitching(false) : undefined} />
      </div>
    )
  }

  const external = account.provider && account.provider !== 'firstParty'
  const plan = account.subscriptionType && account.subscriptionType[0].toUpperCase() + account.subscriptionType.slice(1)
  const name = account.email ?? (external ? PROVIDERS[account.provider!] ?? account.provider! : 'Conta conectada')

  return (
    <>
      <div className="flex items-center gap-4 rounded-lg border border-line p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-text">
          {name[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-text">{name}</div>
          <div className="mt-0.5 text-xs text-faint">
            {[account.organization, plan, account.method === 'console' && 'Anthropic Console'].filter(Boolean).join(' - ')}
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-done">
          <span className="size-1.5 rounded-full bg-done" />
          Conectada
        </span>
      </div>

      {external ? (
        <p className="mt-4 text-xs leading-relaxed text-faint">
          O acesso vem das variáveis de ambiente ou das configurações do Claude Code, não de um login. Para trocar,
          mude por lá.
        </p>
      ) : (
        <div className="mt-2">
          <Row label="Trocar de conta" description="Entra com outra conta no lugar desta.">
            <button
              onClick={() => setSwitching(true)}
              className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
            >
              Trocar
            </button>
          </Row>
          <Row
            label="Sair"
            description={
              logoutFailed
                ? 'Não deu para sair. Tente de novo ou rode "claude auth logout" no Terminal.'
                : 'Desconecta o Claude Code deste Mac: vale também para o terminal e o VS Code.'
            }
          >
            <button
              onClick={() =>
                setConfirm({
                  title: 'Sair da conta?',
                  description: `O Claude Code deste Mac sai de ${name}, inclusive no terminal e no VS Code. Conversas trabalhando agora terminam o pedido atual.`,
                  confirmLabel: 'Sair',
                  onConfirm: () => void window.api.auth.logout().then((ok) => setLogoutFailed(!ok))
                })
              }
              className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Sair
            </button>
          </Row>
        </div>
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

// Conteúdo do modal de configurações: seções à esquerda, opções à direita.
export function SettingsPage({
  theme,
  onThemeChange,
  onClose
}: {
  theme: ThemePreference
  onThemeChange: (t: ThemePreference) => void
  onClose: () => void
}) {
  const [section, setSection] = useState<Section>('general')
  const title = SECTIONS.find((s) => s.id === section)!.label

  return (
    <div className="flex h-full">
      <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line bg-surface-2/40 p-3">
        <div className="mb-3 px-2 pt-1 text-sm font-semibold">Configurações</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${
              section === s.id ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>

      <section className="relative min-w-0 flex-1 overflow-y-auto">
        <button
          aria-label="Fechar"
          title="Fechar"
          onClick={onClose}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={15} />
        </button>
        <div className="px-8 py-7">
          <h1 className="mb-4 text-lg font-semibold">{title}</h1>
          {section === 'general' && <GeneralSection />}
          {section === 'conversations' && <ConversationsSection />}
          {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
          {section === 'account' && <AccountSection />}
        </div>
      </section>
    </div>
  )
}
