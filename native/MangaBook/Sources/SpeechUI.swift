import SwiftUI

struct VoiceWaveformView: View {
    var audioLevel: Float

    var body: some View {
        HStack(spacing: 2.5) {
            ForEach(0..<4) { index in
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Color.accentColor)
                    .frame(
                        width: 2.5,
                        height: max(4, CGFloat(audioLevel) * CGFloat(14 + (index % 2) * 6))
                    )
                    .animation(.spring(response: 0.15, dampingFraction: 0.5), value: audioLevel)
            }
        }
    }
}

/// A compact Liquid Glass dictation button for search fields
struct VoiceSearchButton: View {
    var onTranscript: (String) -> Void
    @State private var speech = SpeechService.shared

    var body: some View {
        Button {
            if speech.isListening {
                speech.stop()
            } else {
                speech.startDictation { text in
                    onTranscript(text)
                }
            }
        } label: {
            HStack(spacing: 4) {
                if speech.isListening {
                    VoiceWaveformView(audioLevel: speech.audioLevel)
                    Image(systemName: "stop.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                } else {
                    Image(systemName: "mic.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(speech.isListening ? "停止语音输入" : "语音输入")
    }
}

/// Floating Liquid Glass Hands-free voice reading pill in the Reader HUD
struct HandsFreeReaderControl: View {
    var onCommand: (VoiceCommand) -> Void
    @State private var speech = SpeechService.shared
    @State private var isEnabled = false
    @State private var lastRecognized: String?

    var body: some View {
        Button {
            isEnabled.toggle()
            if isEnabled {
                speech.startReadingCommands { command in
                    lastRecognized = command.rawValue
                    onCommand(command)
                    Task {
                        try? await Task.sleep(for: .seconds(1.2))
                        if lastRecognized == command.rawValue {
                            lastRecognized = nil
                        }
                    }
                }
            } else {
                speech.stop()
                lastRecognized = nil
            }
        } label: {
            HStack(spacing: 5) {
                if isEnabled {
                    VoiceWaveformView(audioLevel: speech.audioLevel)
                    if let cmd = lastRecognized {
                        Text(cmd)
                            .font(.caption)
                            .bold()
                            .foregroundStyle(Color.accentColor)
                            .transition(.scale.combined(with: .opacity))
                    } else {
                        Text("语音翻页中")
                            .font(.caption)
                            .foregroundStyle(.primary)
                    }
                } else {
                    Image(systemName: "mic.slash")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("语音翻页")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isEnabled ? Color.accentColor.opacity(0.20) : Color.white.opacity(0.08))
            )
            .overlay(
                Capsule()
                    .stroke(isEnabled ? Color.accentColor.opacity(0.60) : Color.white.opacity(0.12), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .help("开启免动手语音翻页：说「下一页」或「上一页」")
        .animation(.snappy(duration: 0.2), value: isEnabled)
        .animation(.snappy(duration: 0.2), value: lastRecognized)
        .onDisappear {
            if isEnabled {
                speech.stop()
            }
        }
    }
}
