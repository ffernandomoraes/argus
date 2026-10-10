import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

// `fallback` no lugar do aviso padrão; como função, recebe o erro e um `reset` que tenta desenhar
// a tela de novo (útil num drawer, sem recarregar a janela inteira).
type Fallback = ReactNode | ((error: Error, reset: () => void) => ReactNode)

type Props = { children: ReactNode; fallback?: Fallback }
type State = { error: Error | null }

// Erro ao desenhar uma parte da tela não deixa a janela em branco: no lugar dela aparece o aviso,
// e o erro vai para o console (com a pilha dos componentes, para achar onde foi).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary] erro ao desenhar a tela:', error, info.componentStack)
  }

  reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    if (typeof fallback === 'function') return fallback(error, this.reset)
    if (fallback !== undefined) return fallback
    return <ErrorNotice error={error} />
  }
}

function ErrorNotice({ error }: { error: Error }) {
  return (
    <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
      <p className="text-sm text-muted">Algo deu errado nesta tela.</p>
      {/* A mensagem do erro, pequena, para quem for relatar o problema. */}
      {error.message && (
        <p className="max-w-md truncate font-mono text-[11px] text-faint select-text" title={error.message}>
          {error.message}
        </p>
      )}
      <Button variant="primary" onClick={() => location.reload()}>
        Recarregar
      </Button>
    </div>
  )
}
