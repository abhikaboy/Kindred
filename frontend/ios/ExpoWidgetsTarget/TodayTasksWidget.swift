import WidgetKit
import SwiftUI

struct TodayTasksWidget: Widget {
  let name: String = "TodayTasksWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.today)) { entry in
      TodayTasksView(entry: entry)
    }
    .configurationDisplayName("Today")
    .description("What's due today, what's late, and how far along you are.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .containerBackgroundRemovable(false)
  }
}

struct TodayTasksView: View {
  let entry: KindredEntry<TodayPayload>
  /// Lets previews and snapshot renders pick a size; WidgetKit's value is read-only.
  var familyOverride: WidgetFamily? = nil
  @Environment(\.widgetFamily) private var environmentFamily
  private var family: WidgetFamily { familyOverride ?? environmentFamily }
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    Group {
      if let today = entry.payload {
        switch family {
        case .systemSmall: small(today)
        case .systemLarge: large(today)
        default: medium(today)
        }
      } else {
        NotSyncedView()
      }
    }
    .widgetURL(KindredLinks.today)
    .kindredBackground(scheme, motif: entry.payload == nil ? .none : .today)
  }

  private var overdueCount: Int {
    entry.payload?.tasks.filter { $0.isOverdue(at: entry.date) }.count ?? 0
  }

  // MARK: Small

  private func small(_ today: TodayPayload) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      header
      Spacer(minLength: 0)
      if today.remainingCount == 0 {
        EmptyDayView(allDone: today.allDone, compact: true)
      } else {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text("\(today.remainingCount)")
            .font(.kindredDisplay(40))
            .contentTransition(.numericText())
          Text("left")
            .font(.outfit(13, .medium))
            .foregroundStyle(KindredPalette.caption)
        }
        ProgressBar(progress: today.progress, track: KindredPalette.track(scheme))
          .padding(.vertical, 6)
        if let next = today.tasks.first {
          Text(next.title)
            .font(.outfit(12, .medium))
            .foregroundStyle(KindredPalette.caption)
            .lineLimit(1)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // MARK: Medium

  private func medium(_ today: TodayPayload) -> some View {
    HStack(alignment: .center, spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        WidgetEyebrow(text: "Today")
        Spacer(minLength: 0)
        RingSummary(today: today, size: 64, scheme: scheme)
        Text(today.total == 0 ? "Nothing due" : "\(today.completedCount) of \(today.total) done")
          .font(.outfit(11, .medium))
          .foregroundStyle(KindredPalette.caption)
          .lineLimit(1)
      }
      .frame(width: 92, alignment: .leading)

      if today.remainingCount == 0 {
        // The ring beside it already carries the icon
        EmptyDayView(allDone: today.allDone, compact: false, showIcon: false)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        TaskList(tasks: today.tasks, total: today.remainingCount, limit: 3, now: entry.date, showWorkspace: false)
      }
    }
  }

  // MARK: Large

  private func large(_ today: TodayPayload) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 12) {
        RingSummary(today: today, size: 52, scheme: scheme)
        VStack(alignment: .leading, spacing: 2) {
          WidgetEyebrow(text: "Today")
          Text(entry.date, format: .dateTime.weekday(.wide).month().day())
            .font(.kindredDisplay(20))
            .lineLimit(1)
          summaryLine(today)
        }
        Spacer(minLength: 0)
      }

      Rectangle()
        .fill(KindredPalette.track(scheme))
        .frame(height: 1)

      if today.remainingCount == 0 {
        EmptyDayView(allDone: today.allDone, compact: false)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        TaskList(tasks: today.tasks, total: today.remainingCount, limit: 5, now: entry.date, showWorkspace: true)
      }
    }
  }

  private var header: some View {
    HStack {
      WidgetEyebrow(text: "Today")
      Spacer(minLength: 0)
      if overdueCount > 0 {
        Text("\(overdueCount) late")
          .font(.outfit(11, .semibold))
          .foregroundStyle(KindredPalette.overdue)
      }
    }
  }

  private func summaryLine(_ today: TodayPayload) -> some View {
    HStack(spacing: 6) {
      Text("\(today.completedCount) of \(today.total) done")
        .foregroundStyle(KindredPalette.caption)
      if overdueCount > 0 {
        Text("\(overdueCount) overdue")
          .foregroundStyle(KindredPalette.overdue)
      }
    }
    .font(.outfit(12, .medium))
  }
}

// MARK: - Pieces

private struct RingSummary: View {
  let today: TodayPayload
  let size: CGFloat
  let scheme: ColorScheme

  var body: some View {
    ZStack {
      ProgressRing(
        progress: today.progress,
        lineWidth: size * 0.12,
        tint: today.allDone ? KindredPalette.success(scheme) : KindredPalette.brand,
        track: KindredPalette.track(scheme)
      )
      if today.allDone {
        Image(systemName: "checkmark")
          .font(.system(size: size * 0.32, weight: .bold))
          .foregroundStyle(KindredPalette.success(scheme))
      } else {
        Text("\(today.completedCount)")
          .font(.kindredDisplay(size * 0.36))
          .monospacedDigit()
      }
    }
    .frame(width: size, height: size)
  }
}

private struct ProgressBar: View {
  let progress: Double
  let track: Color

  var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule()
          .fill(KindredPalette.brand)
          .frame(width: max(6, proxy.size.width * min(progress, 1)))
          .widgetAccentable()
      }
    }
    .frame(height: 6)
  }
}

private struct EmptyDayView: View {
  let allDone: Bool
  let compact: Bool
  var showIcon = true
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if showIcon {
        Image(systemName: allDone ? "checkmark.seal.fill" : "sun.max.fill")
          .font(.system(size: compact ? 22 : 26, weight: .semibold))
          .foregroundStyle(allDone ? KindredPalette.success(scheme) : KindredPalette.brand)
          .widgetAccentable()
      }
      Text(allDone ? "All clear" : "Nothing due today")
        .font(.kindredDisplay(compact ? 17 : 19))
      Text(allDone ? "Every task for today is done." : "Enjoy the open space.")
        .font(.outfit(12))
        .foregroundStyle(KindredPalette.caption)
        .lineLimit(2)
    }
  }
}
