// Microfone do ditado: só grava e entrega o áudio (ready, level, audio, error); quem transcreve é
// o app, com o serviço de voz do Claude. JSON por linha no stdout. Para com "stop" no stdin (ou stdin fechado).
import AVFoundation
import Darwin
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

// O macOS atribui o pedido de permissão ao processo "responsável", que por padrão é quem
// abriu o app (o terminal, o VS Code...). Se esse processo não declara uso do microfone, o
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

// Volume da voz (0 a 1) para as ondas na interface, umas 20 vezes por segundo.
private var lastLevelAt = Date.distantPast
func emitLevel(_ buffer: AVAudioPCMBuffer) {
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

// Só grava, sem reconhecer: entrega o áudio do microfone em 16 kHz, mono, 16 bits (o formato
// que a transcrição do Claude espera), em base64 numa linha "audio". Quem transcreve é o app.
final class Capture {
  private let engine = AVAudioEngine()

  func start() throws {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
    guard let converter = AVAudioConverter(from: format, to: target) else {
      fail("Não consegui converter o áudio do microfone (\(format)).", code: 4)
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
      emitLevel(buffer)
      Capture.send(buffer, converter, target)
    }
    engine.prepare()
    try engine.start()
    emit(["type": "ready"])
  }

  private static func send(_ buffer: AVAudioPCMBuffer, _ converter: AVAudioConverter, _ target: AVAudioFormat) {
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * target.sampleRate / buffer.format.sampleRate) + 16
    guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
    var given = false
    var error: NSError?
    converter.convert(to: out, error: &error) { _, status in
      if given {
        status.pointee = .noDataNow
        return nil
      }
      given = true
      status.pointee = .haveData
      return buffer
    }
    guard error == nil, out.frameLength > 0, let samples = out.int16ChannelData?[0] else { return }
    let data = Data(bytes: samples, count: Int(out.frameLength) * MemoryLayout<Int16>.size)
    emit(["type": "audio", "data": data.base64EncodedString()])
  }

  func stop() -> Never {
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    exit(0)
  }
}

// stdin: "stop" (ou fim) encerra.
func listenForStop(_ stop: @escaping () -> Void) {
  Thread {
    while let line = readLine() {
      if line.trimmingCharacters(in: .whitespaces) == "stop" { break }
    }
    DispatchQueue.main.async(execute: stop)
  }.start()
}

func withMicrophone(_ start: @escaping () throws -> Void) {
  AVCaptureDevice.requestAccess(for: .audio) { granted in
    guard granted else {
      fail("Sem permissão de microfone. Libere em Ajustes do Sistema > Privacidade e Segurança > Microfone.", code: 3)
    }
    DispatchQueue.main.async {
      do { try start() } catch { fail("Não consegui abrir o microfone: \(error.localizedDescription)", code: 4) }
    }
  }
}

let capture = Capture()
listenForStop { capture.stop() }
withMicrophone { try capture.start() }

dispatchMain()
