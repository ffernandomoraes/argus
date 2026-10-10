import { FilePen, Hand, ListChecks, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react'

// Modos de permissão do --permission-mode, com nomes e descrições da extensão do VS Code, traduzidos.
export const MODES: { value: string; label: string; description: string; icon: LucideIcon; danger?: boolean }[] = [
  { value: 'manual', label: 'Manual', description: 'Pede aprovação antes de cada edição.', icon: Hand },
  { value: 'acceptEdits', label: 'Editar automaticamente', description: 'Edita os arquivos sem pedir aprovação.', icon: FilePen },
  { value: 'plan', label: 'Plano', description: 'Explora o código e apresenta um plano antes de editar.', icon: ListChecks },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Aprova o que passa numa checagem de segurança e para no que for arriscado.',
    icon: ShieldCheck
  },
  {
    value: 'bypassPermissions',
    label: 'Ignorar permissões',
    description: 'Não pede aprovação nem para comandos potencialmente perigosos.',
    icon: ShieldOff,
    danger: true
  }
]
