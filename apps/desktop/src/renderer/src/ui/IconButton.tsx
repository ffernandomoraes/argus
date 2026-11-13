import type { ComponentProps } from 'react'
import { iconButtonClass, type ButtonVariant, type IconButtonSize } from './buttonStyles'

export type IconButtonProps = Omit<ComponentProps<'button'>, 'aria-label'> & {
  // Nome do botão para leitor de tela; também vira o title, salvo se `title` vier.
  label: string
  variant?: ButtonVariant
  size?: IconButtonSize
  danger?: boolean
  // Botão de alternar ligado (vira aria-pressed).
  pressed?: boolean
}

// Botão quadrado só com ícone (o ícone vem como filho, com o tamanho dele). Padrão: ghost de 28 px,
// o dos cabeçalhos e do X dos modais. `className` só para o lugar dele, como no Button.
export function IconButton({ label, title, variant, size, danger, pressed, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      className={`${iconButtonClass(variant, size, { danger, pressed })}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}
