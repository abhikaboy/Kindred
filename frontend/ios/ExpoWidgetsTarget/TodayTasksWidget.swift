import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct TodayTasksWidget: Widget {
  let name: String = "TodayTasksWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Today's Tasks")
    .description("See your tasks due today and track your progress.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
