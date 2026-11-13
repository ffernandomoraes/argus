import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, WandSparkles } from 'lucide-react'
import { MascotFigure } from '../../canvas/mascot/MascotFigure'
import { tr } from '../../i18n'
import { Presence } from '../../motion'
import { Button } from '../../ui/Button'
import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { MascotEditor, STAGE_VIEW } from './MascotEditor'

// Aba Mascote (com o experimento ligado): o boneco como está, o botão que abre o editor em tela
// cheia e onde ele fica (solto por cima de tudo ou dentro do canvas). O editor vai para o body, por
// cima das configurações: dentro delas, ficaria preso na caixa.
export function MascotSection() {
  const look = usePreference('mascotLook')
  const floating = usePreference('mascotFloating')
  const [editing, setEditing] = useState(false)
  return (
    <>
      <div className="mb-4 flex flex-col items-center gap-4 rounded-xl bg-fill px-6 py-6 text-center">
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
          {/* Volta ao canto de sempre: o solto na tela, ao de baixo da tela principal (perdeu de vista,
              ou no Mac, onde arrastar é com o sistema e os dois cliques não chegam a ele); o do
              canvas, à borda esquerda da janela. */}
          <Button
            size="xl"
            onClick={() => {
              window.api.mascot.home()
              setPreferences({ mascotCanvasSpot: null })
            }}
          >
            <CornerDownLeft size={15} />
            {tr('Trazer para o canto', 'Bring back to the corner')}
          </Button>
        </div>
        {createPortal(<Presence kind="modal">{editing && <MascotEditor onClose={() => setEditing(false)} />}</Presence>, document.body)}
      </div>
      <Group>
        <Row
          label={tr('Fixo por cima de todas as janelas', 'Pinned on top of every window')}
          description={tr('Fica solto na tela, por cima de qualquer app.', 'Roams the screen, on top of any app.')}
          info={tr(
            'Ligado, ele fica solto na tela, por cima de qualquer app (navegador, editor...), e anda até a pasta no envio. Desligado, ele vive dentro do canvas do Argus e só aparece nele.',
            'On, it roams the screen on top of any app (browser, editor...) and walks to the folder on send. Off, it lives inside the Argus canvas and only shows there.'
          )}
        >
          <Switch label={tr('Fixo por cima de todas as janelas', 'Pinned on top of every window')} checked={floating} onChange={(next) => setPreferences({ mascotFloating: next })} />
        </Row>
      </Group>
    </>
  )
}
