import SwiftUI

struct CreateAuthorSheet: View {
    @Binding var isPresented: Bool
    var onCreate: (String) -> Void

    @State private var name = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            Text("新建作者目录")
                .font(.title3)
                .bold()

            TextField("作者名", text: $name)
                .textFieldStyle(.roundedBorder)

            HStack {
                Spacer()
                Button("取消", role: .cancel) {
                    isPresented = false
                }
                .keyboardShortcut(.cancelAction)

                Button("创建") {
                    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    onCreate(trimmed)
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 420)
    }
}
