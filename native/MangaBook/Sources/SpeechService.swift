import Foundation
import Speech
import AVFoundation
import Observation

enum VoiceCommand: String, Sendable {
    case nextPage = "下一页"
    case previousPage = "上一页"
    case close = "关闭"
}

@MainActor
@Observable
final class SpeechService: NSObject {
    static let shared = SpeechService()

    var isListening = false
    var isAuthorized = false
    var transcribedText = ""
    var recognizedCommand: VoiceCommand?
    var audioLevel: Float = 0.0
    var errorMessage: String?

    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var onCommandDetected: ((VoiceCommand) -> Void)?

    override init() {
        super.init()
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    }

    func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                Task { @MainActor in
                    let granted = status == .authorized
                    self.isAuthorized = granted
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    // MARK: - Hands-free Reading Voice Command Mode

    func startReadingCommands(onCommand: @escaping (VoiceCommand) -> Void) {
        stop()
        self.onCommandDetected = onCommand

        Task {
            if !isAuthorized {
                let granted = await requestAuthorization()
                guard granted else {
                    errorMessage = "未获得语音识别权限"
                    return
                }
            }
            startAudioEngine(isCommandMode: true)
        }
    }

    // MARK: - Dictation Mode for Search / Input

    func startDictation(onResult: @escaping (String) -> Void) {
        stop()

        Task {
            if !isAuthorized {
                let granted = await requestAuthorization()
                guard granted else {
                    errorMessage = "未获得语音识别权限"
                    return
                }
            }
            startAudioEngine(isCommandMode: false, onText: onResult)
        }
    }

    func stop() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isListening = false
        audioLevel = 0.0
        onCommandDetected = nil
    }

    // MARK: - Audio Engine & Speech Processing

    private func startAudioEngine(isCommandMode: Bool, onText: ((String) -> Void)? = nil) {
        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            errorMessage = "语音识别服务暂不可用"
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if #available(macOS 13.0, *) {
            request.addsPunctuation = false
        }
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)

            // Calculate rough audio RMS for pulsating UI
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frames = buffer.frameLength
            var sum: Float = 0.0
            for i in 0..<Int(frames) {
                let sample = channelData[i]
                sum += sample * sample
            }
            let rms = sqrt(sum / Float(max(frames, 1)))
            Task { @MainActor [weak self] in
                self?.audioLevel = min(1.0, max(0.0, rms * 5.0))
            }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            isListening = true
            transcribedText = ""
        } catch {
            errorMessage = "无法启动麦克风：\(error.localizedDescription)"
            stop()
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                Task { @MainActor in
                    self.transcribedText = text
                    if isCommandMode {
                        self.processCommand(text)
                    } else {
                        onText?(text)
                    }
                }
            }
            if error != nil || (result?.isFinal ?? false) {
                if !isCommandMode {
                    Task { @MainActor in self.stop() }
                }
            }
        }
    }

    private func processCommand(_ text: String) {
        let cleaned = text.lowercased()
        let nextKeywords = ["下一页", "下页", "后一页", "翻页", "往后", "下一张"]
        let prevKeywords = ["上一页", "上页", "前一页", "往前", "上一张"]
        let closeKeywords = ["退出", "关闭", "返回", "关掉"]

        if nextKeywords.contains(where: { cleaned.contains($0) }) {
            recognizedCommand = .nextPage
            onCommandDetected?(.nextPage)
            restartCommandStream()
        } else if prevKeywords.contains(where: { cleaned.contains($0) }) {
            recognizedCommand = .previousPage
            onCommandDetected?(.previousPage)
            restartCommandStream()
        } else if closeKeywords.contains(where: { cleaned.contains($0) }) {
            recognizedCommand = .close
            onCommandDetected?(.close)
            restartCommandStream()
        }
    }

    private func restartCommandStream() {
        recognitionRequest?.endAudio()
        let newRequest = SFSpeechAudioBufferRecognitionRequest()
        newRequest.shouldReportPartialResults = true
        recognitionRequest = newRequest
        if let recognizer = speechRecognizer {
            recognitionTask = recognizer.recognitionTask(with: newRequest) { [weak self] result, _ in
                guard let self, let result else { return }
                let text = result.bestTranscription.formattedString
                Task { @MainActor in
                    self.processCommand(text)
                }
            }
        }
    }
}
