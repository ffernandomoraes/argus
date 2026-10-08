import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AppWindow,
  Check,
  Copy,
  MessagesSquare,
  Monitor,
  Moon,
  Palette,
  PanelRight,
  Pencil,
  PictureInPicture2,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  Users,
  X
} from 'lucide-react'
import { EFFORTS, groupByFamily } from '../conversation/ModelEffortPicker'
import { MODES } from '../conversation/PermissionModePicker'
import type { SessionSettings } from '../conversation/SessionSettings'
import { useClaudeInfo } from '../conversation/useModels'
import { LoginPanel } from '../auth/LoginPanel'
import { findAccount, useAuth } from '../auth/useAuth'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import { displayPath } from '../canvas/factory'
import { MAIN_ACCOUNT, type AuthState, type ClaudeAccount } from '../../../shared/auth'
import type { CliStatus } from '../../../shared/cli'
import type { ThemePreference } from '../theme/useTheme'
import { BUTTON, Group, Row, Segmented, Select, Switch } from './controls'
import { setPreferences, usePreferences } from './preferences'
import { useUpdates } from '../updates/useUpdates'
import { Presence } from '../motion'
import { IS_WIN, SYSTEM_NAME, THIS_COMPUTER } from '../platform'

type Section = 'general' | 'conversations' | 'appearance' | 'accounts'

// Cada seção com o ícone e a frase do cabeçalho dela. Ícone solto, sem quadradinho: com fundo
// ficou carregado demais.
const SECTIONS: { id: Section; label: string; icon: typeof Settings2; description: string }[] = [
  {
    id: 'general',
    label: 'Geral',
    icon: Settings2,
    description: 'Onde as conversas abrem, o ícone do sistema, o comando no terminal e as atualizações.'
  },
  {
    id: 'conversations',
    label: 'Conversas',
    icon: MessagesSquare,
    description: 'Como cada conversa abre. O que você troca no próprio chat vale só para aquela conversa.'
  },
  { id: 'appearance', label: 'Aparência', icon: Palette, description: 'Tema claro, escuro ou o mesmo do sistema.' },
  { id: 'accounts', label: 'Contas', icon: Users, description: 'As contas do Claude Code que o Argus usa.' }
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
          className={`${BUTTON} text-text hover:bg-surface-2 disabled:opacity-50`}
        >
          {status.installed ? 'Remover' : 'Instalar'}
        </button>
      )}
    </Row>
  )
}

// Na barra de menus do Mac; no Windows, na área de notificação, perto do relógio.
const TRAY = IS_WIN
  ? { label: 'Ícone na área de notificação', where: 'perto do relógio do Windows' }
  : { label: 'Ícone na barra de menus', where: 'no topo do macOS' }

// Guardada no processo principal: o ícone é criado antes de a janela abrir.
function MenuBarIconRow() {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => void window.api.settings.get().then((s) => setOn(s.menuBarIcon)), [])

  return (
    <Row
      label={TRAY.label}
      description={`Mostra ${TRAY.where} quando uma conversa está rodando, precisa de você ou terminou.`}
    >
      {on !== null && (
        <Switch
          label={TRAY.label}
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
          className={`${BUTTON} text-text hover:bg-surface-2`}
        >
          Reiniciar e atualizar
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() => void window.api.updates.check()}
          className={`${BUTTON} text-text hover:bg-surface-2 disabled:opacity-50`}
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
    <Group>
      <Row label="Abrir conversas em" description="O que acontece ao clicar numa conversa no canvas.">
        <Segmented
          value={prefs.openIn}
          onChange={(openIn) => setPreferences({ openIn })}
          options={[
            { value: 'panel', label: 'Painel lateral', icon: <PanelRight size={13} /> },
            { value: 'window', label: 'Janela separada', icon: <AppWindow size={13} /> },
            { value: 'node', label: 'No canvas', icon: <PictureInPicture2 size={13} /> }
          ]}
        />
      </Row>
      <MenuBarIconRow />
      <CliRow />
      <UpdatesRow />
    </Group>
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
      <Group>
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
      </Group>

      <Group>
        <Row label="Thinking" description="Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas.">
          <Switch label="Thinking" checked={s.thinking} onChange={(thinking) => set({ thinking })} />
        </Row>

        <Row label="Ultracode" description="Usa vários subagentes em paralelo em toda tarefa. Gasta bem mais tokens.">
          <Switch label="Ultracode" checked={s.ultracode} onChange={(ultracode) => set({ ultracode })} />
        </Row>
      </Group>
    </>
  )
}

function AppearanceSection({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  return (
    <Group>
      <Row label="Tema" description={`Sistema acompanha o modo claro ou escuro do ${SYSTEM_NAME}.`}>
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
    </Group>
  )
}

const PROVIDERS: Record<string, string> = {
  bedrock: 'Amazon Bedrock',
  vertex: 'Google Vertex AI',
  foundry: 'Microsoft Foundry',
  gateway: 'gateway da empresa'
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[11px] text-faint">{children}</span>
}

// Apelido editável no próprio card: Enter grava, Esc desiste. Vazio volta para o nome sugerido.
function AccountName({ account }: { account: ClaudeAccount }) {
  const [value, setValue] = useState<string | null>(null)
  // O campo some ao terminar, e sumir também tira o foco: o blur que vem junto não grava de novo
  // (nem grava depois de um Esc).
  const finished = useRef(false)

  if (value === null) {
    return (
      <button
        onClick={() => {
          finished.current = false
          setValue(account.name)
        }}
        title="Trocar o apelido"
        className="group/name flex min-w-0 items-center gap-1.5 text-left"
      >
        <span className="truncate text-sm text-text">{account.name}</span>
        <Pencil size={11} className="shrink-0 text-faint opacity-0 group-hover/name:opacity-100" />
      </button>
    )
  }

  const done = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    setValue(null)
    if (save && value.trim() !== account.name) window.api.auth.rename(account.id, value)
  }
  return (
    <input
      autoFocus
      value={value}
      maxLength={40}
      aria-label="Apelido da conta"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(true)
        if (e.key === 'Escape') {
          // O Esc fica aqui: não fecha as configurações.
          e.preventDefault()
          done(false)
        }
      }}
      className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-0.5 text-sm text-text outline-none focus:border-accent"
    />
  )
}

// Comando para usar a conta num terminal qualquer, fora do app.
// No Mac, para o zsh/bash. No Windows, para o PowerShell (lá a variável vale até fechar o terminal).
const terminalCommand = (dir: string) =>
  IS_WIN ? `$env:CLAUDE_CONFIG_DIR="${dir}"; claude` : `CLAUDE_CONFIG_DIR=${displayPath(dir)} claude`

function CopyTerminalCommand({ dir }: { dir: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      title={terminalCommand(dir)}
      onClick={() => {
        void navigator.clipboard.writeText(terminalCommand(dir))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={`${BUTTON} flex items-center gap-1.5 text-muted hover:bg-surface-2 hover:text-text`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copiado' : 'Comando para o terminal'}
    </button>
  )
}

function AccountCard({
  account,
  auth,
  onLogin,
  onConfirm
}: {
  account: ClaudeAccount
  auth: AuthState
  onLogin: () => void
  onConfirm: (req: ConfirmRequest) => void
}) {
  const [logoutFailed, setLogoutFailed] = useState(false)
  const multiple = auth.accounts.length > 1
  const main = account.id === MAIN_ACCOUNT
  const isDefault = auth.defaultId === account.id
  const s = account.status
  const loggedIn = !!s?.loggedIn
  const external = !!s?.provider && s.provider !== 'firstParty'
  const plan = s?.subscriptionType && s.subscriptionType[0].toUpperCase() + s.subscriptionType.slice(1)
  const who = s?.email ?? (external ? PROVIDERS[s.provider!] ?? s.provider! : 'Conta conectada')
  // Rodapé, à esquerda das ações: organização e plano. A organização automática de conta pessoal
  // ("Fulano's Organization") não diz nada e fica de fora.
  const org = s?.organization && !/'s organi[sz]ation$/i.test(s.organization) ? s.organization : null
  const footer = loggedIn ? [org, plan && `Plano ${plan}`, s?.method === 'console' && 'Anthropic Console'].filter(Boolean).join(' - ') : ''
  // Quem passa a valer nos grupos desta conta, se ela sair.
  const fallback = isDefault ? auth.accounts.find((a) => a.id === MAIN_ACCOUNT)?.name : findAccount(auth)?.name

  return (
    <div className="overflow-hidden rounded-xl bg-fill">
      <div className="flex items-center gap-3 p-4">
        {/* Avatar com a inicial, no cinza das contas do macOS. */}
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: 'linear-gradient(180deg, #a1a1a6, #6e6e73)' }}
        >
          {account.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <AccountName account={account} />
            {multiple && main && <Badge>Principal</Badge>}
            {multiple && isDefault && <Badge>Padrão</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {s === null ? 'O Claude Code não respondeu.' : loggedIn ? who : 'Entre para usar esta conta.'}
          </div>
        </div>
        {/* À direita, no meio da altura do cartão. */}
        {s && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[11px] ${
              loggedIn ? 'bg-done/15 text-done' : 'bg-needs-you/15 text-needs-you'
            }`}
          >
            <span className={`size-1.5 rounded-full ${loggedIn ? 'bg-done' : 'bg-needs-you'}`} />
            {loggedIn ? 'Conectada' : 'Sem login'}
          </span>
        )}
      </div>

      {/* Rodapé: organização e plano à esquerda, as ações alinhadas no fim; sair ou remover por último. */}
      <div className="border-t border-line px-4 py-2.5">
        {external ? (
          <p className="text-xs leading-relaxed text-faint">
            O acesso vem das variáveis de ambiente ou das configurações do Claude Code, não de um login. Para trocar,
            mude por lá.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto min-w-0 truncate text-xs text-faint">{footer}</span>
            {account.dir && <CopyTerminalCommand dir={account.dir} />}
            {multiple && !isDefault && (
              <button onClick={() => window.api.auth.setDefault(account.id)} className={`${BUTTON} text-text hover:bg-surface-2`}>
                Usar como padrão
              </button>
            )}
            {/* Conectada, o login serve para pôr outra conta no lugar desta (ou renovar o acesso). */}
            <button
              onClick={onLogin}
              title={loggedIn ? 'Entra com outra conta no lugar desta, ou renova o acesso' : undefined}
              className={`${BUTTON} text-text hover:bg-surface-2`}
            >
              {loggedIn ? 'Trocar conta' : 'Entrar'}
            </button>
            {main
              ? loggedIn && (
                  <button
                    onClick={() =>
                      onConfirm({
                        title: 'Sair da conta?',
                        description: `O Claude Code ${THIS_COMPUTER} sai de ${who}, inclusive no terminal e no VS Code. Conversas trabalhando agora terminam o pedido atual.`,
                        confirmLabel: 'Sair',
                        onConfirm: () => void window.api.auth.logout().then((ok) => setLogoutFailed(!ok))
                      })
                    }
                    className={`${BUTTON} text-red-400 hover:bg-red-500/10`}
                  >
                    Sair
                  </button>
                )
              : (
                  <button
                    onClick={() =>
                      onConfirm({
                        title: `Remover "${account.name}"?`,
                        description: `O Argus sai dessa conta e apaga a pasta dela. Conversas e terminais abertos com ela fecham agora, e os grupos que usavam ela passam a usar ${fallback ?? 'a padrão'}. O histórico das conversas continua.`,
                        confirmLabel: 'Remover',
                        onConfirm: () => void window.api.auth.remove(account.id)
                      })
                    }
                    className={`${BUTTON} text-red-400 hover:bg-red-500/10`}
                  >
                    Remover
                  </button>
                )}
          </div>
        )}
        {logoutFailed && (
          <p role="alert" className="mt-2 text-right text-xs text-red-400">
            Não deu para sair. Tente de novo ou rode "claude auth logout" no {IS_WIN ? 'PowerShell' : 'Terminal'}.
          </p>
        )}
      </div>
    </div>
  )
}

// Contas do Claude Code. A principal é a do terminal e do VS Code: entrar e sair nela valem para o
// Mac todo. As outras ficam só no Argus, cada uma com a pasta e o login dela, e cada grupo do
// canvas escolhe a sua.
function AccountsSection() {
  const auth = useAuth()
  // Login aberto aqui: numa conta da lista ou numa nova (adding).
  const [target, setTarget] = useState<{ accountId?: string } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const login = auth?.login

  // Abrir a seção confere de novo: o login pode ter mudado fora do app.
  useEffect(() => window.api.auth.refresh(), [])

  // Login terminou ou foi cancelado: volta para a lista.
  const status = login?.status
  const prevStatus = useRef(status)
  useEffect(() => {
    if ((prevStatus.current === 'starting' || prevStatus.current === 'waiting') && status === 'idle') setTarget(null)
    prevStatus.current = status
  }, [status])

  if (!auth || !login) return <p className="text-xs text-faint">Conferindo as contas…</p>

  // Login em andamento, mesmo que tenha começado na tela de boas-vindas.
  const active = login.status !== 'idle' ? { accountId: login.adding ? undefined : login.accountId } : target
  if (active) {
    const account = active.accountId ? auth.accounts.find((a) => a.id === active.accountId) : undefined
    return (
      <div className="max-w-sm">
        <p className="mb-4 text-xs leading-relaxed text-faint">
          {!account
            ? 'Entre com a outra conta. Ela fica só no Argus: o terminal e o VS Code continuam com a principal.'
            : account.id === MAIN_ACCOUNT
              ? `Entre com a conta que vai ficar no lugar da principal, ou com a mesma para renovar o acesso. Vale também para o terminal e o VS Code ${THIS_COMPUTER}.`
              : `Entre com a conta que vai ficar no lugar de ${account.name}, ou com a mesma para renovar o acesso.`}
        </p>
        <LoginPanel
          login={login}
          onStart={(method) => (account ? window.api.auth.login(account.id, method) : window.api.auth.add(method))}
          onCancel={() => setTarget(null)}
        />
      </div>
    )
  }

  const multiple = auth.accounts.length > 1
  return (
    <>
      <p className="mb-4 text-xs leading-relaxed text-faint">
        {multiple
          ? 'Cada grupo do canvas usa uma conta: botão direito no grupo > Conta do Claude. Fora de grupo vale a padrão. Histórico, CLAUDE.md, agentes, skills, plugins e configurações são os mesmos em todas; o login e os MCPs são de cada conta.'
          : 'Para usar outra conta em alguns grupos (uma pessoal e uma da empresa, por exemplo), adicione aqui. A principal continua sendo a do terminal e do VS Code.'}
      </p>
      <div className="flex flex-col gap-3">
        {auth.accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            auth={auth}
            onLogin={() => setTarget({ accountId: account.id })}
            onConfirm={setConfirm}
          />
        ))}
      </div>
      <button
        onClick={() => setTarget({})}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text"
      >
        <Plus size={13} />
        Adicionar conta
      </button>
      <Presence kind="modal">
        {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      </Presence>
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
  const current = SECTIONS.find((s) => s.id === section)!
  const CurrentIcon = current.icon

  return (
    <div className="flex h-full">
      {/* Lateral um tom abaixo do conteúdo, como a do Ajustes do Sistema. */}
      <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-bg p-3">
        <div className="mb-3 px-2 pt-1 text-[13px] font-semibold">Configurações</div>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const selected = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] ${
                selected ? 'bg-selection text-white' : 'text-muted hover:bg-fill hover:text-text'
              }`}
            >
              <Icon size={15} />
              {s.label}
            </button>
          )
        })}
        {/* Não é uma seção: fecha as configurações e abre o passo a passo das boas-vindas. Fica no pé da lateral. */}
        <button
          onClick={() => {
            onClose()
            setPreferences({ welcomeSeen: false })
          }}
          className="mt-auto flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-fill hover:text-text"
        >
          <Sparkles size={15} />
          Boas-vindas
        </button>
      </nav>

      <section className="relative min-w-0 flex-1 overflow-y-auto bg-surface">
        <button
          aria-label="Fechar"
          title="Fechar"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text"
        >
          <X size={15} />
        </button>
        <div className="px-8 py-7">
          {/* Cabeçalho da seção, como o do Ajustes do Sistema: ícone grande, nome e o que tem nela. */}
          <header className="mb-4 flex flex-col items-center rounded-xl bg-fill px-6 py-5 text-center">
            <CurrentIcon size={28} strokeWidth={1.75} className="text-muted" />
            <h1 className="mt-2.5 text-lg font-bold">{current.label}</h1>
            <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-muted">{current.description}</p>
          </header>
          {section === 'general' && <GeneralSection />}
          {section === 'conversations' && <ConversationsSection />}
          {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
          {section === 'accounts' && <AccountsSection />}
        </div>
      </section>
    </div>
  )
}
