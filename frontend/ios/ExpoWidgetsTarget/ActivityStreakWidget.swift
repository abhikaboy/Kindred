import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct ActivityStreakWidget: Widget {
  let name: String = "ActivityStreakWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Activity Streak")
    .description("Track your task completion streak.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
