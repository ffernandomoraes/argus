import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, WandSparkles } from 'lucide-react'
import { MascotFigure } from '../../canvas/mascot/MascotFigure'
import { tr } from '../../i18n'
import { Presence } from '../../motion'
import { Button } from '../../ui/Button'
import { usePreference } from '../preferences'
import { MascotEditor, STAGE_VIEW } from './MascotEditor'

// Aba Mascote (com o experimento ligado): o boneco como está e o botão que abre o editor em tela
// cheia. O editor vai para o body, por cima das configurações: dentro delas, ficaria preso na caixa.
export function MascotSection() {
  const look = usePreference('mascotLook')
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-fill px-6 py-6 text-center">
      <button type="button" onClick={() => setEditing(true)} title={tr('Personalizar mascote', 'Customize mascot')} className="h-[180px] w-[300px] cursor-pointer">
        <MascotFigure pose="idle" look={look} view={STAGE_VIEW} />
      </button>
      <p className="max-w-md text-[15px] leading-relaxed text-muted">
        {tr(
          'Corpo, roupa, acessórios, pele, rosto, olhos, boca, cabelo, barba e o golpe que ele dá no envio, num editor em tela cheia.',
          'Body, clothes, accessories, skin, face, eyes, mouth, hair, beard and the strike it gives on send, in a full-screen editor.'
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="xl" variant="primary" onClick={() => setEditing(true)}>
          <WandSparkles size={15} />
          {tr('Personalizar mascote', 'Customize mascot')}
        </Button>
        {/* O boneco solto na tela volta ao canto de baixo da tela principal (perdeu de vista, ou no
            Mac, onde arrastar é com o sistema e os dois cliques não chegam a ele). */}
        <Button size="xl" onClick={() => window.api.mascot.home()}>
          <CornerDownLeft size={15} />
          {tr('Trazer para o canto', 'Bring back to the corner')}
        </Button>
      </div>
      {createPortal(<Presence kind="modal">{editing && <MascotEditor onClose={() => setEditing(false)} />}</Presence>, document.body)}
    </div>
  )
}
