import AppKit
import MangaBookCore

final class MangaGridItem: NSCollectionViewItem {
    static let identifier = NSUserInterfaceItemIdentifier("MangaGridItem")

    /// The 3D Book object container (with drop shadow)
    private let bookShadowHost = NSView()
    /// The clipped book content (cover, spine, badges, progress)
    private let bookCoverContainer = NSView()
    private let coverView = CoverImageView()
    private let spineOverlay = SpineOverlayView()
    private let pageEdgeOverlay = PageEdgeOverlayView()
    private let progress = ProgressStrip()

    // Badges on book cover
    private let pageCountBadge = NSTextField(labelWithString: "")
    private let multiVolumeBadge = NSView()
    private let multiVolumeIcon = NSImageView()
    private let multiVolumeLabel = NSTextField(labelWithString: "多卷")
    private let checkmarkBadge = NSImageView()
    private let tagsStackView = NSStackView()

    // Title below the book
    private let titleLabel = NSTextField(labelWithString: "")

    private var trackingArea: NSTrackingArea?
    private var isHovered = false
    private var loadTask: Task<Void, Never>?
    private var bookID: String?

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true
        view = root

        // 1. Shadow host for the physical book (not clipped so shadow renders smoothly)
        bookShadowHost.wantsLayer = true
        bookShadowHost.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(bookShadowHost)

        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.24)
        shadow.shadowOffset = NSSize(width: 1, height: -5)
        shadow.shadowBlurRadius = 10
        bookShadowHost.shadow = shadow

        // 2. Clipped Book Cover Surface
        bookCoverContainer.wantsLayer = true
        bookCoverContainer.layer?.cornerRadius = 6
        bookCoverContainer.layer?.cornerCurve = .continuous
        bookCoverContainer.layer?.masksToBounds = true
        bookCoverContainer.layer?.backgroundColor = NSColor.quaternaryLabelColor.withAlphaComponent(0.25).cgColor
        bookCoverContainer.layer?.borderWidth = 0.5
        bookCoverContainer.layer?.borderColor = NSColor.white.withAlphaComponent(0.15).cgColor
        bookCoverContainer.translatesAutoresizingMaskIntoConstraints = false
        bookShadowHost.addSubview(bookCoverContainer)

        // Cover artwork
        coverView.wantsLayer = true
        coverView.layer?.contentsGravity = .resizeAspectFill
        coverView.translatesAutoresizingMaskIntoConstraints = false
        bookCoverContainer.addSubview(coverView)

        // Spine 3D curved gradient overlay (left)
        spineOverlay.translatesAutoresizingMaskIntoConstraints = false
        bookCoverContainer.addSubview(spineOverlay)

        // Page edge highlight (right)
        pageEdgeOverlay.translatesAutoresizingMaskIntoConstraints = false
        bookCoverContainer.addSubview(pageEdgeOverlay)

        // Top-left: Page count badge (e.g. "210 页")
        pageCountBadge.font = .systemFont(ofSize: 9.5, weight: .bold)
        pageCountBadge.textColor = .white
        pageCountBadge.drawsBackground = true
        pageCountBadge.backgroundColor = NSColor.black.withAlphaComponent(0.60)
        pageCountBadge.alignment = .center
        pageCountBadge.wantsLayer = true
        pageCountBadge.layer?.cornerRadius = 4
        pageCountBadge.layer?.masksToBounds = true
        pageCountBadge.translatesAutoresizingMaskIntoConstraints = false
        bookCoverContainer.addSubview(pageCountBadge)

        // Top-right: Multi-volume badge (e.g. "多卷")
        multiVolumeBadge.wantsLayer = true
        multiVolumeBadge.layer?.cornerRadius = 4
        multiVolumeBadge.layer?.masksToBounds = true
        multiVolumeBadge.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.65).cgColor
        multiVolumeBadge.translatesAutoresizingMaskIntoConstraints = false
        multiVolumeBadge.isHidden = true
        bookCoverContainer.addSubview(multiVolumeBadge)

        multiVolumeIcon.image = NSImage(systemSymbolName: "books.vertical.fill", accessibilityDescription: nil)
        multiVolumeIcon.contentTintColor = .white
        multiVolumeIcon.translatesAutoresizingMaskIntoConstraints = false
        multiVolumeBadge.addSubview(multiVolumeIcon)

        multiVolumeLabel.font = .systemFont(ofSize: 9.5, weight: .bold)
        multiVolumeLabel.textColor = .white
        multiVolumeLabel.alignment = .left
        multiVolumeLabel.translatesAutoresizingMaskIntoConstraints = false
        multiVolumeBadge.addSubview(multiVolumeLabel)

        // Selected checkmark badge (top-right)
        checkmarkBadge.image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: nil)
        checkmarkBadge.contentTintColor = NSColor.controlAccentColor
        checkmarkBadge.wantsLayer = true
        checkmarkBadge.layer?.backgroundColor = NSColor.white.cgColor
        checkmarkBadge.layer?.cornerRadius = 10
        checkmarkBadge.layer?.masksToBounds = true
        checkmarkBadge.translatesAutoresizingMaskIntoConstraints = false
        checkmarkBadge.isHidden = true
        bookCoverContainer.addSubview(checkmarkBadge)

        // Reading progress line along bottom edge of book
        progress.translatesAutoresizingMaskIntoConstraints = false
        bookCoverContainer.addSubview(progress)

        // Floating tag pills along bottom of cover
        tagsStackView.orientation = .horizontal
        tagsStackView.spacing = 4
        tagsStackView.alignment = .centerY
        tagsStackView.distribution = .fill
        tagsStackView.translatesAutoresizingMaskIntoConstraints = false
        tagsStackView.isHidden = true
        bookCoverContainer.addSubview(tagsStackView)

        // 3. Manga Title below the book
        titleLabel.font = .systemFont(ofSize: 12.5, weight: .semibold)
        titleLabel.textColor = .labelColor
        titleLabel.maximumNumberOfLines = 2
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.cell?.wraps = true
        titleLabel.cell?.isScrollable = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(titleLabel)

        // Autolayout: Book width 176, height ~246 (Aspect ratio ~ 1:1.4)
        NSLayoutConstraint.activate([
            bookShadowHost.topAnchor.constraint(equalTo: root.topAnchor, constant: 4),
            bookShadowHost.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 4),
            bookShadowHost.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -4),
            bookShadowHost.heightAnchor.constraint(equalToConstant: 246),

            bookCoverContainer.topAnchor.constraint(equalTo: bookShadowHost.topAnchor),
            bookCoverContainer.leadingAnchor.constraint(equalTo: bookShadowHost.leadingAnchor),
            bookCoverContainer.trailingAnchor.constraint(equalTo: bookShadowHost.trailingAnchor),
            bookCoverContainer.bottomAnchor.constraint(equalTo: bookShadowHost.bottomAnchor),

            coverView.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor),
            coverView.leadingAnchor.constraint(equalTo: bookCoverContainer.leadingAnchor),
            coverView.trailingAnchor.constraint(equalTo: bookCoverContainer.trailingAnchor),
            coverView.bottomAnchor.constraint(equalTo: bookCoverContainer.bottomAnchor),

            spineOverlay.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor),
            spineOverlay.leadingAnchor.constraint(equalTo: bookCoverContainer.leadingAnchor),
            spineOverlay.bottomAnchor.constraint(equalTo: bookCoverContainer.bottomAnchor),
            spineOverlay.widthAnchor.constraint(equalToConstant: 22),

            pageEdgeOverlay.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor),
            pageEdgeOverlay.trailingAnchor.constraint(equalTo: bookCoverContainer.trailingAnchor),
            pageEdgeOverlay.bottomAnchor.constraint(equalTo: bookCoverContainer.bottomAnchor),
            pageEdgeOverlay.widthAnchor.constraint(equalToConstant: 4),

            pageCountBadge.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor, constant: 7),
            pageCountBadge.leadingAnchor.constraint(equalTo: bookCoverContainer.leadingAnchor, constant: 8),
            pageCountBadge.heightAnchor.constraint(equalToConstant: 17),

            multiVolumeBadge.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor, constant: 7),
            multiVolumeBadge.trailingAnchor.constraint(equalTo: bookCoverContainer.trailingAnchor, constant: -8),
            multiVolumeBadge.heightAnchor.constraint(equalToConstant: 17),

            multiVolumeIcon.leadingAnchor.constraint(equalTo: multiVolumeBadge.leadingAnchor, constant: 4),
            multiVolumeIcon.centerYAnchor.constraint(equalTo: multiVolumeBadge.centerYAnchor),
            multiVolumeIcon.widthAnchor.constraint(equalToConstant: 10),
            multiVolumeIcon.heightAnchor.constraint(equalToConstant: 10),

            multiVolumeLabel.leadingAnchor.constraint(equalTo: multiVolumeIcon.trailingAnchor, constant: 3),
            multiVolumeLabel.trailingAnchor.constraint(equalTo: multiVolumeBadge.trailingAnchor, constant: -5),
            multiVolumeLabel.centerYAnchor.constraint(equalTo: multiVolumeBadge.centerYAnchor),

            checkmarkBadge.topAnchor.constraint(equalTo: bookCoverContainer.topAnchor, constant: 6),
            checkmarkBadge.trailingAnchor.constraint(equalTo: bookCoverContainer.trailingAnchor, constant: -6),
            checkmarkBadge.widthAnchor.constraint(equalToConstant: 20),
            checkmarkBadge.heightAnchor.constraint(equalToConstant: 20),

            progress.leadingAnchor.constraint(equalTo: bookCoverContainer.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: bookCoverContainer.trailingAnchor),
            progress.bottomAnchor.constraint(equalTo: bookCoverContainer.bottomAnchor),
            progress.heightAnchor.constraint(equalToConstant: 3),

            tagsStackView.leadingAnchor.constraint(equalTo: bookCoverContainer.leadingAnchor, constant: 8),
            tagsStackView.trailingAnchor.constraint(lessThanOrEqualTo: bookCoverContainer.trailingAnchor, constant: -8),
            tagsStackView.bottomAnchor.constraint(equalTo: progress.topAnchor, constant: -6),
            tagsStackView.heightAnchor.constraint(equalToConstant: 18),

            titleLabel.topAnchor.constraint(equalTo: bookShadowHost.bottomAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 4),
            titleLabel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -4),
            titleLabel.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor, constant: -4)
        ])
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        updateTrackingAreas()
    }

    private func updateTrackingAreas() {
        if let trackingArea {
            view.removeTrackingArea(trackingArea)
        }
        let area = NSTrackingArea(
            rect: view.bounds,
            options: [.mouseEnteredAndExited, .activeInActiveApp],
            owner: self,
            userInfo: nil
        )
        view.addTrackingArea(area)
        trackingArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        super.mouseEntered(with: event)
        isHovered = true
        NSCursor.pointingHand.push()
        animateHover(hovered: true)
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        isHovered = false
        NSCursor.pop()
        animateHover(hovered: false)
    }

    private func animateHover(hovered: Bool) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.18
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            if hovered {
                let shadow = NSShadow()
                shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
                shadow.shadowOffset = NSSize(width: 2, height: -8)
                shadow.shadowBlurRadius = 16
                bookShadowHost.shadow = shadow
                bookShadowHost.layer?.transform = CATransform3DMakeTranslation(0, 3, 0)
            } else {
                updateSelectionAppearance()
                bookShadowHost.layer?.transform = CATransform3DIdentity
            }
        }
    }

    override var isSelected: Bool {
        didSet { updateSelectionAppearance() }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        loadTask?.cancel()
        loadTask = nil
        bookID = nil
        coverView.setImage(nil)
        titleLabel.stringValue = ""
        pageCountBadge.stringValue = ""
        multiVolumeBadge.isHidden = true
        checkmarkBadge.isHidden = true
        progress.setProgress(0)
        clearTags()
    }

    func configure(book: MangaBook, tags: [MangaTag], coverResolver: CoverResolver?) {
        bookID = book.id
        titleLabel.stringValue = book.title
        var tooltip = book.title
        if !tags.isEmpty {
            tooltip += "\n" + tags.map(\.name).joined(separator: " · ")
        }
        view.toolTip = tooltip

        pageCountBadge.stringValue = "\(book.totalPages) 页"
        pageCountBadge.isHidden = book.totalPages <= 0
        multiVolumeBadge.isHidden = book.structure != .multiVolume
        progress.setProgress(book.progress)
        updateTags(tags)
        updateSelectionAppearance()

        loadTask?.cancel()
        coverView.setImage(nil)
        guard let coverResolver else { return }

        loadTask = Task { [weak self] in
            guard let coverPath = await coverResolver.resolveCoverPath(for: book.folderPath),
                  let image = await ThumbnailService.shared.thumbnail(forImagePath: coverPath) else {
                return
            }
            guard !Task.isCancelled else { return }
            guard let self, self.bookID == book.id else { return }
            self.coverView.setImage(image)
        }
    }

    private func clearTags() {
        for subview in tagsStackView.arrangedSubviews {
            tagsStackView.removeArrangedSubview(subview)
            subview.removeFromSuperview()
        }
        tagsStackView.isHidden = true
    }

    private func updateTags(_ tags: [MangaTag]) {
        clearTags()
        guard !tags.isEmpty else { return }
        tagsStackView.isHidden = false

        let maxDisplayTags = 2
        let displayTags = tags.prefix(maxDisplayTags)
        for tag in displayTags {
            let label = createTagPill(tag.name)
            tagsStackView.addArrangedSubview(label)
        }
        let remaining = tags.count - maxDisplayTags
        if remaining > 0 {
            let moreLabel = createTagPill("+\(remaining)")
            tagsStackView.addArrangedSubview(moreLabel)
        }
    }

    private func createTagPill(_ text: String) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.font = .systemFont(ofSize: 9.5, weight: .bold)
        label.textColor = .white
        label.drawsBackground = true
        label.backgroundColor = NSColor.black.withAlphaComponent(0.60)
        label.alignment = .center
        label.wantsLayer = true
        label.layer?.cornerRadius = 4
        label.layer?.masksToBounds = true
        label.layer?.borderWidth = 0.5
        label.layer?.borderColor = NSColor.white.withAlphaComponent(0.25).cgColor
        label.translatesAutoresizingMaskIntoConstraints = false

        let textSize = (text as NSString).size(withAttributes: [.font: label.font!])
        label.widthAnchor.constraint(equalToConstant: max(16, textSize.width + 10)).isActive = true
        label.heightAnchor.constraint(equalToConstant: 17).isActive = true
        return label
    }

    private func updateSelectionAppearance() {
        checkmarkBadge.isHidden = !isSelected
        if isSelected {
            bookCoverContainer.layer?.borderWidth = 3
            bookCoverContainer.layer?.borderColor = NSColor.controlAccentColor.cgColor
            let accentShadow = NSShadow()
            accentShadow.shadowColor = NSColor.controlAccentColor.withAlphaComponent(0.40)
            accentShadow.shadowOffset = NSSize(width: 0, height: -4)
            accentShadow.shadowBlurRadius = 14
            bookShadowHost.shadow = accentShadow
        } else {
            bookCoverContainer.layer?.borderWidth = 0.5
            bookCoverContainer.layer?.borderColor = NSColor.white.withAlphaComponent(0.18).cgColor
            let normalShadow = NSShadow()
            normalShadow.shadowColor = NSColor.black.withAlphaComponent(0.24)
            normalShadow.shadowOffset = NSSize(width: 1, height: -5)
            normalShadow.shadowBlurRadius = 10
            bookShadowHost.shadow = normalShadow
        }
    }
}
