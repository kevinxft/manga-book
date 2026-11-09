import SwiftUI

struct StartupErrorView: View {
    let message: String

    var body: some View {
        ContentUnavailableView {
            Label("无法启动数据库", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        } description: {
            Text(message)
                .font(.callout)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 520)
        }
        .padding(Theme.Spacing.section)
    }
}
