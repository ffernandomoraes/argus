import { execFile } from 'node:child_process'

// O Windows não encerra processos por falta de memória: quando a memória virtual acaba, o pedido de
// memória falha e o programa quebra sozinho. Na hora, o próprio Windows registra o aviso de memória
// virtual baixa no log do Sistema (o "Feche programas para evitar perda de informações"): evento
// 2004 do Resource-Exhaustion-Detector. A permissão padrão do log do Sistema deixa quem está logado
// ler, sem ser administrador (não conferido num Windows de verdade).

const QUERY_TIMEOUT_MS = 10_000

// Houve o aviso de memória virtual baixa do Windows nos últimos `withinMs`?
export function lowMemoryLogged(withinMs: number): Promise<boolean> {
  const query = `*[System[Provider[@Name='Microsoft-Windows-Resource-Exhaustion-Detector'] and (EventID=2004) and TimeCreated[timediff(@SystemTime) <= ${Math.round(withinMs)}]]]`
  return new Promise((resolve) => {
    execFile('wevtutil', ['qe', 'System', `/q:${query}`, '/c:1', '/rd:true', '/f:text'], { timeout: QUERY_TIMEOUT_MS, windowsHide: true }, (err, out) =>
      resolve(!err && /2004/.test(out))
    )
  })
}
