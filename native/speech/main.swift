// Ditado em tempo real com o reconhecimento de fala do macOS.
// Fala JSON por linha no stdout: ready, level (volume 0–1), text (texto acumulado), warning, error, done.
// Para com "stop" no stdin (ou stdin fechado).
import AVFoundation
import Darwin
import Foundation
import Speech

setvbuf(stdout, nil, _IOLBF, 0)

// O macOS atribui o pedido de permissão ao processo "responsável", que por padrão é quem
// abriu o app (o terminal, o VS Code...). Se esse processo não declara uso de fala, o
// sistema derruba o ditado. Por isso o programa se reabre como responsável por si mesmo
// (mesma técnica de terminais como o iTerm) e usa o Info.plist embutido neste binário.
@_silgen_name("responsibility_spawnattrs_setdisclaim")
func responsibility_spawnattrs_setdisclaim(_ attrs: UnsafeMutablePointer<posix_spawnattr_t?>, _ disclaim: Int32) -> Int32

if ProcessInfo.processInfo.environment["SPEECH_HELPER_CHILD"] == nil {
  var attrs: posix_spawnattr_t?
  posix_spawnattr_init(&attrs)
  _ = responsibility_spawnattrs_setdisclaim(&attrs, 1)
  setenv("SPEECH_HELPER_CHILD", "1", 1)
  let path = Bundle.main.executablePath ?? CommandLine.arguments[0]
  var argv = CommandLine.arguments.map { strdup($0) } + [nil]
  var pid: pid_t = 0
  // stdin/stdout/stderr são herdados: o app conversa direto com o processo filho.
  if posix_spawn(&pid, path, nil, &attrs, &argv, environ) == 0 {
    var status: Int32 = 0
    waitpid(pid, &status, 0)
    exit((status >> 8) & 0xff)
  }
  // Se não der para reabrir, segue no próprio processo.
}

func emit(_ obj: [String: Any]) {
  if let data = try? JSONSerialization.data(withJSONObject: obj), let line = String(data: data, encoding: .utf8) {
    print(line)
  }
}

func fail(_ message: String, code: Int32, action: String? = nil) -> Never {
  var event: [String: Any] = ["type": "error", "message": message]
  if let action { event["action"] = action }
  emit(event)
  exit(code)
}

// Termos que aparecem o tempo todo nas conversas sobre código e que o reconhecedor erra
// por serem inglês no meio do português ("drawer" virava "tower"). Avisá-lo antes faz ele
// preferir estas palavras quando o som for parecido.
let vocabulary = [
  "drawer", "canvas", "sidebar", "navbar", "modal", "popup", "tooltip", "badge", "card", "layout",
  "placeholder", "checkbox", "dropdown", "scroll", "hover", "drag", "drop", "timeline", "viewport",
  "dark mode", "light mode", "design system", "token", "front-end", "back-end", "fullstack",
  "Electron", "React", "TypeScript", "JavaScript", "Node", "Vite", "Tailwind", "pnpm", "npm",
  "Claude", "Claude Code", "Opus", "Sonnet", "Haiku", "MCP", "SDK", "API", "CLI", "VS Code",
  "GitHub", "Git", "branch", "merge", "pull request", "commit", "deploy", "build", "debug", "bug",
  "log", "diff", "patch", "refactor", "refatorar", "endpoint", "request", "response", "cache",
  "array", "string", "boolean", "componente", "props", "state", "hook", "render", "performance",
  "prompt", "markdown", "chat", "thread", "workspace", "repositório", "feature", "release",
  "agente", "subagente", "terminal", "shell", "bash", "ditado", "canva", "grid", "flexbox"
]

final class Dictation {
  private let engine = AVAudioEngine()
  private let recognizer: SFSpeechRecognizer
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  // Trechos já fechados pelo reconhecedor; o atual é somado a eles.
  private var committed = ""
  // Texto do trecho em andamento (pode ser revisado pelo reconhecedor até fechar).
  private var partial = ""
  private var taskSeq = 0
  private var stopping = false
  private var errorsInARow = 0
  // O reconhecimento online da Apple acerta bem mais; o offline fica como reserva
  // para quando não houver internet.
  private var offline = false

  init(recognizer: SFSpeechRecognizer) {
    self.recognizer = recognizer
  }

  private var lastLevelAt = Date.distantPast

  func start() throws {
    let input = engine.inputNode
    input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buffer, _ in
      self?.request?.append(buffer)
      self?.emitLevel(buffer)
    }
    engine.prepare()
    try engine.start()
    newTask()
    emit(["type": "ready"])
  }

  // O reconhecedor encerra o trecho em pausas longas ou no limite de tempo; um novo começa em seguida.
  private func newTask() {
    // Numera o trecho novo primeiro: respostas atrasadas do anterior (inclusive o
    // cancelamento) ficam com número velho e são descartadas.
    taskSeq += 1
    let seq = taskSeq
    request?.endAudio()
    task?.cancel()
    partial = ""

    let req = SFSpeechAudioBufferRecognitionRequest()
    req.shouldReportPartialResults = true
    req.addsPunctuation = true
    // Avisa que é ditado (fala contínua), não comando curto.
    req.taskHint = .dictation
    req.contextualStrings = vocabulary
    req.requiresOnDeviceRecognition = offline
    request = req

    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      guard let self, seq == self.taskSeq else { return }
      if let result {
        self.errorsInARow = 0
        let incoming = result.bestTranscription.formattedString
        // Depois de uma pausa o reconhecedor pode recomeçar do zero, mandando um texto que
        // não continua o anterior. Nesse caso o que já havia é guardado, em vez de sumir.
        if !self.continues(incoming) { self.commitPartial() }
        self.partial = incoming
        emit(["type": "text", "text": self.join(self.committed, self.partial)])
        if result.isFinal {
          self.commitPartial()
          if self.stopping { self.finish() }
          self.newTask()
        }
      } else if let error {
        // O texto já reconhecido neste trecho nunca se perde: entra no acumulado antes de seguir.
        self.commitPartial()
        if self.stopping { self.finish() }
        // 201: Siri e Ditado desligados nos Ajustes; o reconhecimento da Apple depende deles.
        let ns = error as NSError
        if ns.domain == "kLSRErrorDomain" && ns.code == 201 {
          fail(
            "O Ditado do macOS está desligado. Ligue em Ajustes do Sistema > Teclado > Ditado (não precisa da Siri).",
            code: 6, action: "dictation-settings")
        }
        self.errorsInARow += 1
        // Online falhando seguido (sem internet, servidor fora): segue offline.
        if !self.offline, self.errorsInARow >= 2, self.recognizer.supportsOnDeviceRecognition {
          self.offline = true
          self.errorsInARow = 0
          emit([
            "type": "warning",
            "message": "Sem conexão para o reconhecimento online; usando o do seu Mac, que erra mais."
          ])
          self.newTask()
          return
        }
        // Erro repetido sem nenhum resultado = problema de verdade (permissão, sem rede...).
        // Com texto já reconhecido, insiste bem mais: derrubar o ditado no meio é pior.
        if self.errorsInARow > (self.committed.isEmpty ? 3 : 30) { fail(error.localizedDescription, code: 5) }
        self.newTask()
      }
    }
  }

  // Só letras e números, sem acento nem maiúsculas: compara o conteúdo, não a pontuação.
  private func key(_ text: String) -> String {
    text.lowercased()
      .folding(options: .diacriticInsensitive, locale: nil)
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .joined()
  }

  // O reconhecedor revisa o trecho atual o tempo todo (troca palavras, ajusta pontuação),
  // e a revisão mantém o começo. Começo diferente = ele recomeçou, e o trecho anterior
  // precisa ser guardado antes.
  private func continues(_ incoming: String) -> Bool {
    let old = key(partial)
    let new = key(incoming)
    if old.isEmpty || new.isEmpty { return true }
    if new.hasPrefix(old) || old.hasPrefix(new) { return true }
    let n = min(old.count, new.count, 10)
    return old.prefix(n) == new.prefix(n)
  }

  private func commitPartial() {
    committed = join(committed, partial)
    partial = ""
  }

  // Volume da voz (0 a 1) para as ondas na interface, umas 20 vezes por segundo.
  private func emitLevel(_ buffer: AVAudioPCMBuffer) {
    let now = Date()
    guard now.timeIntervalSince(lastLevelAt) >= 0.05, let samples = buffer.floatChannelData?[0] else { return }
    lastLevelAt = now
    let count = Int(buffer.frameLength)
    guard count > 0 else { return }
    var sum: Float = 0
    for i in 0..<count { sum += samples[i] * samples[i] }
    let rms = (sum / Float(count)).squareRoot()
    // -50 dB (silêncio) a 0 dB (muito alto) vira 0 a 1.
    let db = 20 * log10(max(rms, 0.000_001))
    let level = min(1, max(0, (db + 50) / 50))
    emit(["type": "level", "value": Double(level)])
  }

  func stop() {
    guard !stopping else { return }
    stopping = true
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    request?.endAudio()
    // Espera o último trecho fechar; se demorar, sai com o que tem.
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.finish() }
  }

  private func finish() -> Never {
    commitPartial()
    emit(["type": "done", "text": committed])
    exit(0)
  }

  private func join(_ a: String, _ b: String) -> String {
    a.isEmpty ? b : (b.isEmpty ? a : a + " " + b)
  }
}

let localeId = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "pt-BR"
guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId)), recognizer.isAvailable else {
  fail("Reconhecimento de fala indisponível para \(localeId).", code: 1)
}
let dictation = Dictation(recognizer: recognizer)

// stdin: "stop" (ou fim) encerra.
Thread {
  while let line = readLine() {
    if line.trimmingCharacters(in: .whitespaces) == "stop" { break }
  }
  DispatchQueue.main.async { dictation.stop() }
}.start()

SFSpeechRecognizer.requestAuthorization { status in
  guard status == .authorized else {
    fail("Sem permissão de reconhecimento de fala. Libere em Ajustes do Sistema > Privacidade e Segurança > Reconhecimento de Fala.", code: 2)
  }
  AVCaptureDevice.requestAccess(for: .audio) { granted in
    guard granted else {
      fail("Sem permissão de microfone. Libere em Ajustes do Sistema > Privacidade e Segurança > Microfone.", code: 3)
    }
    DispatchQueue.main.async {
      do { try dictation.start() } catch { fail("Não consegui abrir o microfone: \(error.localizedDescription)", code: 4) }
    }
  }
}

dispatchMain()
