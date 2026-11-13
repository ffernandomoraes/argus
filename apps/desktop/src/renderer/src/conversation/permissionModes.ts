import { FilePen, Hand, ListChecks, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react'
import { tr } from '../i18n'

// Modos de permissão do --permission-mode, com nomes e descrições da extensão do VS Code, traduzidos.
export const MODES: { value: string; label: string; description: string; icon: LucideIcon; danger?: boolean }[] = [
  { value: 'manual', label: 'Manual', description: tr('Pede aprovação antes de cada edição.', 'Asks for approval before each edit.'), icon: Hand },
  { value: 'acceptEdits', label: tr('Editar automaticamente', 'Edit automatically'), description: tr('Edita os arquivos sem pedir aprovação.', 'Edits files without asking for approval.'), icon: FilePen },
  { value: 'plan', label: tr('Plano', 'Plan'), description: tr('Explora o código e apresenta um plano antes de editar.', 'Explores the code and presents a plan before editing.'), icon: ListChecks },
  {
    value: 'auto',
    label: 'Auto',
    description: tr('Aprova o que passa numa checagem de segurança e para no que for arriscado.', 'Approves what passes a safety check and stops on anything risky.'),
    icon: ShieldCheck
  },
  {
    value: 'bypassPermissions',
    label: tr('Ignorar permissões', 'Bypass permissions'),
    description: tr('Não pede aprovação nem para comandos potencialmente perigosos.', 'Doesn’t ask for approval, even for potentially dangerous commands.'),
    icon: ShieldOff,
    danger: true
  }
]
