import type { ComponentProps } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles'

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  danger?: boolean
  // Botão de alternar ligado (vira aria-pressed).
  pressed?: boolean
}

// Botão de texto (com ou sem ícone antes). `className` é só para o lugar dele (margem, largura,
// posição): cor, borda e tamanho vêm da variante, e uma classe concorrente não ganha com certeza.
export function Button({ variant, size, danger, pressed, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`${buttonClass(variant, size, { danger, pressed })}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}
