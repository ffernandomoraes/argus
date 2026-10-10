// Pix do "Me pague um café": a chave e o texto do "Pix copia e cola" (o mesmo do QR Code).
export const PIX_KEY = '772b807a-f1e6-4796-827e-185ca87573b5'
const PIX_NAME = 'FERNANDO MORAES LIMA'
// Obrigatória no padrão do Pix, mas o banco não confere: só aparece para quem paga.
const PIX_CITY = 'SAO PAULO'

// Campo do BR Code (padrão EMV do Banco Central): id + tamanho com 2 dígitos + valor.
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), calculado sobre tudo até o "6304" inclusive.
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Pix estático sem valor: quem paga escolhe quanto. É o mesmo texto do "Pix copia e cola".
export const PIX_PAYLOAD = (() => {
  const body =
    field('00', '01') +
    field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', PIX_KEY)) +
    field('52', '0000') +
    field('53', '986') +
    field('58', 'BR') +
    field('59', PIX_NAME) +
    field('60', PIX_CITY) +
    field('62', field('05', '***')) +
    '6304'
  return body + crc16(body)
})()
