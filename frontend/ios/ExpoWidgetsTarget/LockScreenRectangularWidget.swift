import WidgetKit
import SwiftUI

struct LockScreenRectangularWidget: Widget {
  let name: String = "LockScreenRectangularWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.nextTask)) { entry in
      LockScreenRectangularView(entry: entry)
    }
    .configurationDisplayName("Next Up")
    .description("Your next deadline, counting down.")
    .supportedFamilies([.accessoryRectangular])
  }
}

struct LockScreenRectangularView: View {
  let entry: KindredEntry<NextTaskPayload>

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      if let task = entry.payload?.task, let due = task.dueDate {
        Label("Next up", systemImage: "clock")
          .font(.outfit(12, .semibold))
          .widgetAccentable()
        Text(task.title)
          .font(.outfit(15, .semibold))
          .lineLimit(1)
        HStack(spacing: 3) {
          Text("Due")
          Text(due, style: .time)
        }
        .font(.outfit(12))
        .foregroundStyle(KindredPalette.caption)
        .lineLimit(1)
      } else {
        Label("Kindred", systemImage: "checkmark.circle")
          .font(.outfit(12, .semibold))
          .widgetAccentable()
        Text("No upcoming deadlines")
          .font(.outfit(15, .semibold))
          .lineLimit(1)
        if let remaining = entry.payload?.remainingCount, remaining > 0 {
          Text("\(remaining) left today")
            .font(.outfit(12))
            .foregroundStyle(KindredPalette.caption)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .widgetURL(entry.payload?.task.map(KindredLinks.task) ?? KindredLinks.today)
    .accessoryBackground()
  }
}
