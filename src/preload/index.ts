import { contextBridge, webUtils } from 'electron'
import type { Api } from '../shared/api'
import { invoke, listen, listenKey, send, sendSync } from './ipc'
import { onEdit, onReloadKey } from './keys'
import { winMic } from './winMic'

// Monta o `window.api` (formato em src/shared/api.ts; canais em src/shared/ipc.ts). Sem módulos do
// Node além do electron: o preload fica pronto para rodar com sandbox.

const IS_WIN = process.platform === 'win32'
// Onde a janela grava o microfone do ditado (preload/winMic): fora do Mac.
const WINDOW_MIC = process.platform !== 'darwin'

// Pasta pessoal, como o os.homedir() do processo principal: USERPROFILE no Windows, HOME no Mac.
const homeDir = (IS_WIN ? (process.env.USERPROFILE ?? process.env.HOME) : (process.env.HOME ?? process.env.USERPROFILE)) ?? ''

// Windows: o build é o terceiro número da versão ("10.0.22631"). Disponível também com sandbox.
function windowsBuild(): number | null {
  if (!IS_WIN) return null
  const build = Number(process.getSystemVersion().split('.')[2])
  return Number.isInteger(build) && build > 0 ? build : null
}

const api: Api = {
  platform: process.platform,
  homeDir,
  windowsBuild: windowsBuild(),
  setTheme: (theme) => send('theme:set', theme),
  setInterfaceZoom: (factor) => send('interface:zoom', factor),
  clipboardCommand: (command) => send('clipboard:command', command),
  accent: {
    get: () => sendSync('accent:get'),
    onChange: (cb) => listen('accent:changed', cb)
  },
  language: {
    get: () => sendSync('language:get') ?? 'pt',
    onChange: (cb) => listen('language:changed', cb)
  },
  pickFolder: (distro) => invoke('dialog:pickFolder', distro),
  pickFolders: (distro) => invoke('dialog:pickFolders', distro),
  syncWorkspace: (folders, dir) => invoke('workspace:sync', folders, dir),
  wsl: {
    distros: () => invoke('wsl:distros'),
    diagnostics: () => invoke('wsl:diagnostics')
  },
  onReloadKey,
  onEdit,
  // No Windows e no Linux o microfone é gravado aqui mesmo (winMic); no Mac, pelo programa
  // native/speech.
  speech: {
    start: () => (WINDOW_MIC ? void winMic.start() : send('speech:start')),
    stop: () => {
      if (WINDOW_MIC) winMic.stop()
      send('speech:stop')
    },
    openSettings: () => send('speech:openSettings'),
    onEvent: (cb) => {
      const off = listen('speech:event', cb)
      const offMic = WINDOW_MIC ? winMic.onEvent(cb) : () => {}
      return () => {
        off()
        offMic()
      }
    }
  },
  transcription: {
    model: () => invoke('transcription:model'),
    download: () => send('transcription:download'),
    cancel: () => send('transcription:cancel'),
    onModel: (cb) => listen('transcription:model', cb),
    transcribe: (samples) => invoke('transcription:transcribe', samples)
  },
  popout: {
    open: (id, payload) => send('popout:open', id, payload),
    payload: (id) => invoke('popout:payload', id),
    onClosed: (cb) => listen('popout:closed', cb)
  },
  mascot: {
    setEnabled: (on) => send('mascot:enabled', on),
    setTyping: (typing) => send('mascot:typing', typing),
    setInteractive: (on) => send('mascot:interactive', on),
    dragTo: (x, y) => send('mascot:drag', x, y),
    dragEnd: () => send('mascot:dragEnd'),
    home: () => send('mascot:home'),
    reportTarget: (key, turn, rect) => send('mascot:target', key, turn, rect),
    findTarget: (key, turn) => invoke('mascot:findTarget', key, turn),
    walk: (x, y) => invoke('mascot:walk', x, y),
    homeSpot: () => invoke('mascot:homeSpot'),
    alerts: () => invoke('mascot:alerts'),
    onAlerts: (cb) => listen('mascot:alerts', cb),
    onTyping: (cb) => listen('mascot:typing', cb),
    onReleased: (cb) => listen('mascot:released', cb)
  },
  orchestrator: {
    setEnabled: (on) => send('orchestrator:enabled', on)
  },
  claude: {
    info: (account) => invoke('claude:info', account),
    onInfo: (cb) => listen('claude:info', cb)
  },
  claudeVersion: {
    get: () => invoke('claudeVersion:get'),
    check: () => invoke('claudeVersion:check'),
    update: () => invoke('claudeVersion:update'),
    onState: (cb) => listen('claudeVersion:state', cb)
  },
  auth: {
    state: () => invoke('auth:state'),
    refresh: () => send('auth:refresh'),
    install: () => send('auth:install'),
    login: (accountId, method) => send('auth:login', accountId, method),
    add: (method) => send('auth:add', method),
    submitCode: (code) => send('auth:code', code),
    cancel: () => send('auth:cancel'),
    logout: () => invoke('auth:logout'),
    remove: (accountId) => invoke('auth:remove', accountId),
    rename: (accountId, name) => send('auth:rename', accountId, name),
    setDefault: (accountId) => send('auth:setDefault', accountId),
    open: (url) => send('auth:open', url),
    onState: (cb) => listen('auth:state', cb)
  },
  providers: {
    state: () => invoke('providers:state'),
    refresh: (provider) => send('providers:refresh', provider),
    install: (provider) => send('providers:install', provider),
    add: (provider) => send('providers:add', provider),
    login: (provider, accountId) => send('providers:login', provider, accountId),
    clipboardKey: () => invoke('providers:clipboardKey'),
    submitKey: (key) => send('providers:submitKey', key),
    cancel: () => send('providers:cancel'),
    remove: (provider, accountId) => send('providers:remove', provider, accountId),
    rename: (provider, accountId, name) => send('providers:rename', provider, accountId, name),
    setDefault: (provider, accountId) => send('providers:setDefault', provider, accountId),
    onState: (cb) => listen('providers:state', cb)
  },
  filePath: (file) => webUtils.getPathForFile(file),
  accountMcp: {
    status: (account, wait) => invoke('mcp:account:status', account, wait),
    reconnect: (account, name) => invoke('mcp:account:reconnect', account, name),
    authenticate: (account, name) => invoke('mcp:account:authenticate', account, name),
    clearAuth: (account, name) => invoke('mcp:account:clearAuth', account, name),
    remove: (account, name, scope) => invoke('mcp:account:remove', account, name, scope),
    release: (account) => send('mcp:account:release', account)
  },
  chat: {
    state: (key) => invoke('chat:state', key),
    send: (req) => send('chat:send', req),
    remoteControl: (req) => send('chat:remote-control', req),
    answer: (key, id, answer) => send('chat:answer', key, id, answer),
    interrupt: (key) => send('chat:interrupt', key),
    retain: (key) => send('chat:retain', key),
    mcpStatus: (key, cwd, account) => invoke('mcp:status', key, cwd, account),
    mcpReconnect: (key, name) => invoke('mcp:reconnect', key, name),
    mcpAuthenticate: (key, name) => invoke('mcp:authenticate', key, name),
    mcpClearAuth: (key, name) => invoke('mcp:clearAuth', key, name),
    mcpRemove: (key, cwd, account, name, scope) => invoke('mcp:remove', key, cwd, account, name, scope),
    outputStyle: (key, cwd, account) => invoke('chat:outputStyle', key, cwd, account),
    setOutputStyle: (key, cwd, style) => invoke('chat:setOutputStyle', key, cwd, style),
    release: (key) => send('chat:release', key),
    restartIn: (cwd) => send('chat:restartIn', cwd),
    configure: (key, patch) => send('chat:configure', key, patch),
    onState: (cb) => listen('chat:state', cb),
    onOpen: (cb) => listen('chat:open', cb),
    active: () => invoke('chat:active'),
    onActive: (cb) => listen('chat:active', cb),
    setUnread: (chats) => send('chat:unread', chats)
  },
  agents: {
    list: (provider, projectPath) => invoke('agents:list', provider, projectPath),
    save: (provider, req) => invoke('agents:save', provider, req),
    remove: (provider, name) => invoke('agents:remove', provider, name)
  },
  memory: {
    list: (projects) => invoke('memory:list', projects),
    read: (path, projects) => invoke('memory:read', path, projects),
    write: (path, text, projects, base) => invoke('memory:write', path, text, projects, base)
  },
  canvas: {
    load: () => sendSync('canvas:load'),
    sync: (nodes) => send('canvas:sync', nodes),
    onRemote: (cb) => listen('canvas:remote', cb),
    record: () => send('canvas:record'),
    undo: () => send('canvas:undo'),
    forget: (ids) => send('canvas:forget', ids),
    redo: () => send('canvas:redo'),
    viewport: () => sendSync('canvas:viewport'),
    setViewport: (viewport) => send('canvas:setViewport', viewport),
    newWindow: () => send('canvas:newWindow')
  },
  canvasAgent: {
    state: () => invoke('canvasAgent:state'),
    send: (text) => send('canvasAgent:send', text),
    interrupt: () => send('canvasAgent:interrupt'),
    onState: (cb) => listen('canvasAgent:state', cb),
    onCall: (cb) => listen('canvasAgent:call', cb),
    respond: (result) => send('canvasAgent:result', result),
    onCancel: (cb) => listen('canvasAgent:cancel', cb)
  },
  design: {
    load: (id) => invoke('design:load', id),
    save: (design) => invoke('design:save', design),
    list: (projectPath) => invoke('design:list', projectPath),
    trash: (id) => invoke('design:trash', id),
    escape: (origin, on) => send('design:escape', origin, on),
    track: (origin) => send('design:track', origin),
    snapshot: (origin) => invoke('design:snapshot', origin),
    comment: (origin, action, id) => send('design:comment', origin, action, id),
    routes: (projectPath) => invoke('design:routes', projectPath)
  },
  sessions: {
    list: (path) => invoke('sessions:list', path),
    folders: () => invoke('sessions:folders'),
    search: (path, query) => invoke('sessions:search', path, query),
    trash: (path, id) => invoke('sessions:trash', path, id),
    branch: (path) => invoke('sessions:branch', path),
    branches: (path) => invoke('sessions:branches', path),
    fetch: (path) => invoke('sessions:fetch', path),
    checkout: (path, option, create) => invoke('sessions:checkout', path, option, create),
    repoUrl: (path) => invoke('sessions:repoUrl', path),
    openRepo: (path) => send('sessions:openRepo', path),
    changes: (path) => invoke('sessions:changes', path),
    history: (path, id) => invoke('sessions:history', path, id),
    historyPage: (path, id, request) => invoke('sessions:historyPage', path, id, request),
    images: (path, id, messageId) => invoke('sessions:images', path, id, messageId),
    context: (path, id) => invoke('sessions:context', path, id),
    watch: (paths) => send('sessions:watch', paths),
    onChanged: (cb) => listen('sessions:changed', cb)
  },
  worktrees: {
    reserve: (folder) => invoke('worktrees:reserve', folder),
    adopt: (path, from) => invoke('worktrees:adopt', path, from),
    status: (path) => invoke('worktrees:status', path),
    remove: (path) => invoke('worktrees:remove', path)
  },
  devServers: {
    list: (paths) => invoke('devServers:list', paths),
    kill: (pgid, paths) => invoke('devServers:kill', pgid, paths)
  },
  projectServers: {
    status: (paths) => invoke('projectServers:status', paths),
    start: (path, noBrowser) => invoke('projectServers:start', path, noBrowser),
    stop: (path) => invoke('projectServers:stop', path)
  },
  files: {
    list: (root, rel) => invoke('files:list', root, rel),
    read: (root, rel) => invoke('files:read', root, rel),
    locate: (root, rel) => invoke('files:locate', root, rel),
    image: (path) => invoke('files:image', path),
    diff: (root, rel) => invoke('files:diff', root, rel),
    write: (root, rel, text, base) => invoke('files:write', root, rel, text, base),
    create: (root, dir, name, isDir) => invoke('files:create', root, dir, name, isDir),
    rename: (root, rel, name) => invoke('files:rename', root, rel, name),
    trash: (root, rel) => invoke('files:trash', root, rel),
    copy: (root, rels) => invoke('files:copy', root, rels),
    paste: (root, dir) => invoke('files:paste', root, dir),
    reveal: (root, rel) => send('files:reveal', root, rel),
    openFolder: (path) => send('files:openFolder', path),
    view: (root, rel) => send('files:view', root, rel),
    openInBrowser: (root, rel) => send('files:openInBrowser', root, rel),
    watch: (root, rel) => send('files:watch', root, rel),
    unwatch: () => send('files:unwatch'),
    onChanged: (cb) => listen('files:changed', cb),
    setUnsaved: (has) => send('files:unsaved', has)
  },
  terminal: {
    open: (req) => invoke('terminal:open', req),
    write: (key, data) => send('terminal:write', key, data),
    resize: (key, cols, rows) => send('terminal:resize', key, cols, rows),
    kill: (key) => send('terminal:kill', key),
    onData: (key, cb) => listenKey('terminal:data', key, cb),
    onExit: (cb) => listen('terminal:exit', cb),
    session: (key) => invoke('terminal:session', key),
    onSession: (cb) => listen('terminal:session', cb),
    link: (key, conversations) => send('terminal:link', key, conversations),
    unlink: (key) => send('terminal:unlink', key),
    onTyped: (key, cb) => listenKey('terminal:typed', key, cb),
    onOpenFor: (cb) => listen('terminal:openFor', cb)
  },
  cli: {
    ready: () => send('cli:ready'),
    onOpen: (cb) => listen('cli:open', cb),
    status: () => invoke('cli:status'),
    install: () => invoke('cli:install'),
    uninstall: () => invoke('cli:uninstall')
  },
  settings: {
    get: () => invoke('settings:get'),
    setMenuBarIcon: (on) => invoke('settings:menuBarIcon', on),
    setLanguage: (pref) => invoke('settings:language', pref)
  },
  updates: {
    get: () => invoke('updates:get'),
    check: () => invoke('updates:check'),
    notes: () => invoke('updates:notes'),
    install: () => send('updates:install'),
    onState: (cb) => listen('updates:state', cb)
  },
  usage: {
    get: () => invoke('usage:get'),
    onUpdate: (cb) => listen('usage:update', cb)
  },
  media: {
    get: () => invoke('media:get'),
    command: (command) => invoke('media:command', command),
    setVolume: (volume) => invoke('media:volume', volume)
  }
}

contextBridge.exposeInMainWorld('api', api)
