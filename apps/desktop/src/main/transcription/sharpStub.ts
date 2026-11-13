// O transformers.js importa o sharp (imagens) logo de cara, mas a transcrição de áudio não usa: no
// lugar dele entra este vazio, e o app não leva o binário do sharp.
export default function sharp(): never {
  throw new Error('sharp não está disponível no Argus')
}
