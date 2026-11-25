import { createContext } from 'react';
import type { ButtonSize } from './buttonStyles';

// Tamanho dos botões sem `size` dentro de uma área. As Configurações dão o 'field' (a medida dos
// campos), sem passar o tamanho em cada botão; fora delas vale o md.
export const ButtonSizeContext = createContext<ButtonSize>('md');
