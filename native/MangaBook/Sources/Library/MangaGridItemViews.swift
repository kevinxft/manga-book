import AppKit

final class CoverImageView: NSView {
    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        layer?.contentsScale = window?.backingScaleFactor ?? 2
    }

    func setImage(_ image: CGImage?) {
        guard let layer else { return }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer.contentsScale = window?.backingScaleFactor ?? 2
        layer.contents = image
        CATransaction.commit()
    }
}

final class SpineOverlayView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        let spineWidth: CGFloat = 20
        let colors = [
            NSColor.black.withAlphaComponent(0.42).cgColor,
            NSColor.black.withAlphaComponent(0.14).cgColor,
            NSColor.white.withAlphaComponent(0.18).cgColor,
            NSColor.clear.cgColor
        ] as CFArray
        let locations: [CGFloat] = [0, 0.22, 0.48, 1]
        guard let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors,
            locations: locations
        ) else { return }
        context.drawLinearGradient(
            gradient,
            start: CGPoint(x: 0, y: 0),
            end: CGPoint(x: spineWidth, y: 0),
            options: []
        )
    }
}

final class PageEdgeOverlayView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        context.setStrokeColor(NSColor.white.withAlphaComponent(0.30).cgColor)
        context.setLineWidth(1)
        context.move(to: CGPoint(x: bounds.width - 0.5, y: 0))
        context.addLine(to: CGPoint(x: bounds.width - 0.5, y: bounds.height))
        context.strokePath()
    }
}

final class ProgressStrip: NSView {
    private let track = NSView()
    private let fill = NSView()
    private var fillWidth: NSLayoutConstraint?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true

        track.wantsLayer = true
        track.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.45).cgColor
        track.translatesAutoresizingMaskIntoConstraints = false
        addSubview(track)

        fill.wantsLayer = true
        fill.layer?.backgroundColor = NSColor.controlAccentColor.cgColor
        fill.translatesAutoresizingMaskIntoConstraints = false
        track.addSubview(fill)

        NSLayoutConstraint.activate([
            track.leadingAnchor.constraint(equalTo: leadingAnchor),
            track.trailingAnchor.constraint(equalTo: trailingAnchor),
            track.bottomAnchor.constraint(equalTo: bottomAnchor),
            track.heightAnchor.constraint(equalToConstant: 3),
            fill.leadingAnchor.constraint(equalTo: track.leadingAnchor),
            fill.topAnchor.constraint(equalTo: track.topAnchor),
            fill.bottomAnchor.constraint(equalTo: track.bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func setProgress(_ value: Double) {
        fillWidth?.isActive = false
        let clamped = min(1, max(0, value))
        let constraint = fill.widthAnchor.constraint(equalTo: track.widthAnchor, multiplier: max(0.015, clamped))
        constraint.isActive = true
        fillWidth = constraint
        isHidden = clamped <= 0
    }
}
