import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LucideProvider } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import './index.css'
import { App } from './App'
import { hasDrafts } from './code/drafts'
import { loadEditor } from './code/editor/useCodeEditor'
import { loadXterm } from './conversation/terminal/useXterm'
import { tr } from './i18n'
import { PopoutApp } from './conversation/PopoutApp'
import { ErrorBoundary } from './ui/ErrorBoundary'

// Cor de destaque do sistema antes do primeiro desenho, para não piscar o azul padrão. Sem ela,
// vale a do index.css.
const applyAccent = (color: string | null) =>
  color
    ? document.documentElement.style.setProperty('--color-accent', color)
    : document.documentElement.style.removeProperty('--color-accent')
applyAccent(window.api.accent.get())
window.api.accent.onChange(applyAccent)

// Idioma trocado nos ajustes: recarrega para redesenhar os textos. Rascunhos do painel de código só
// existem na memória; com algum, pergunta antes (sem recarregar, fica no idioma antigo até a próxima).
window.api.language.onChange(() => {
  const question = tr(
    'Para trocar o idioma, a janela recarrega e descarta as alterações não salvas no painel de código. Recarregar agora?',
    'Changing the language reloads the window and discards unsaved changes in the code panel. Reload now?'
  )
  if (!hasDrafts() || window.confirm(question)) location.reload()
})

// Editor e terminal ficam fora do que roda na abertura; carregam logo depois, com a janela ociosa,
// para o primeiro arquivo ou terminal aberto não esperar. Terminal já aberto na abertura carrega
// por conta própria (useXterm).
requestIdleCallback(
  () => {
    loadXterm().catch((err: unknown) => console.error('[abertura] pré-carregar o terminal:', err))
    loadEditor().catch((err: unknown) => console.error('[abertura] pré-carregar o editor:', err))
  },
  { timeout: 3000 }
)

// A mesma página serve a janela principal e as janelas de conversa (#popout/<id>).
const popout = location.hash.match(/^#popout\/(.+)$/)

// Traço 1.5 em todos os ícones, no lugar do 2 padrão do lucide.
// Erro ao desenhar a janela não a deixa em branco: aparece o aviso para recarregar. O canvas tem
// o seu, dentro do App, para as boas-vindas e as configurações continuarem funcionando.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LucideProvider strokeWidth={1.5}>
      <ErrorBoundary>{popout ? <PopoutApp id={decodeURIComponent(popout[1])} /> : <App />}</ErrorBoundary>
    </LucideProvider>
  </StrictMode>
)
