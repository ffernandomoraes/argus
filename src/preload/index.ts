import { contextBridge, webUtils } from 'electron'
import type { Api } from '../shared/api'
import { invoke, listen, send, sendSync } from './ipc'
import { onEdit, onReloadKey } from './keys'
import { winMic } from './winMic'

// Monta o `window.api` (formato em src/shared/api.ts; canais em src/shared/ipc.ts). Sem módulos do
// Node além do electron: o preload fica pronto para rodar com sandbox.

const IS_WIN = process.platform === 'win32'

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
  accent: {
    get: () => sendSync('accent:get'),
    onChange: (cb) => listen('accent:changed', cb)
  },
  pickFolder: () => invoke('dialog:pickFolder'),
  onReloadKey,
  onEdit,
  // No Windows o microfone é gravado aqui mesmo (winMic); no Mac, pelo programa native/speech.
  speech: {
    start: () => (IS_WIN ? void winMic.start() : send('speech:start')),
    stop: () => {
      if (IS_WIN) winMic.stop()
      send('speech:stop')
    },
    openSettings: () => send('speech:openSettings'),
    onEvent: (cb) => {
      const off = listen('speech:event', cb)
      const offMic = IS_WIN ? winMic.onEvent(cb) : () => {}
      return () => {
        off()
        offMic()
      }
    }
  },
  popout: {
    open: (id, payload) => send('popout:open', id, payload),
    payload: (id) => invoke('popout:payload', id),
    onClosed: (cb) => listen('popout:closed', cb)
  },
  claude: {
    info: (account) => invoke('claude:info', account),
    onInfo: (cb) => listen('claude:info', cb)
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
  filePath: (file) => webUtils.getPathForFile(file),
  chat: {
    state: (key) => invoke('chat:state', key),
    send: (req) => send('chat:send', req),
    remoteControl: (req) => send('chat:remote-control', req),
    answer: (key, id, answer) => send('chat:answer', key, id, answer),
    interrupt: (key) => send('chat:interrupt', key),
    retain: (key) => send('chat:retain', key),
    mcpStatus: (key, cwd, account) => invoke('mcp:status', key, cwd, account),
    release: (key) => send('chat:release', key),
    configure: (key, patch) => send('chat:configure', key, patch),
    onState: (cb) => listen('chat:state', cb),
    onOpen: (cb) => listen('chat:open', cb)
  },
  agents: {
    list: (projectPath) => invoke('agents:list', projectPath),
    save: (req) => invoke('agents:save', req),
    remove: (name) => invoke('agents:remove', name)
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
    trash: (path, id) => invoke('sessions:trash', path, id),
    branch: (path) => invoke('sessions:branch', path),
    repoUrl: (path) => invoke('sessions:repoUrl', path),
    openRepo: (path) => send('sessions:openRepo', path),
    changes: (path) => invoke('sessions:changes', path),
    history: (path, id) => invoke('sessions:history', path, id),
    images: (path, id, messageId) => invoke('sessions:images', path, id, messageId),
    context: (path, id) => invoke('sessions:context', path, id),
    watch: (paths) => send('sessions:watch', paths),
    onChanged: (cb) => listen('sessions:changed', cb)
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
    diff: (root, rel) => invoke('files:diff', root, rel),
    write: (root, rel, text, base) => invoke('files:write', root, rel, text, base),
    create: (root, dir, name, isDir) => invoke('files:create', root, dir, name, isDir),
    rename: (root, rel, name) => invoke('files:rename', root, rel, name),
    trash: (root, rel) => invoke('files:trash', root, rel),
    copy: (root, rels) => invoke('files:copy', root, rels),
    paste: (root, dir) => invoke('files:paste', root, dir),
    reveal: (root, rel) => send('files:reveal', root, rel),
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
    onData: (cb) => listen('terminal:data', cb),
    onExit: (cb) => listen('terminal:exit', cb),
    session: (key) => invoke('terminal:session', key),
    onSession: (cb) => listen('terminal:session', cb)
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
    setMenuBarIcon: (on) => invoke('settings:menuBarIcon', on)
  },
  updates: {
    get: () => invoke('updates:get'),
    check: () => invoke('updates:check'),
    install: () => send('updates:install'),
    onState: (cb) => listen('updates:state', cb)
  },
  usage: {
    get: () => invoke('usage:get'),
    onUpdate: (cb) => listen('usage:update', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
