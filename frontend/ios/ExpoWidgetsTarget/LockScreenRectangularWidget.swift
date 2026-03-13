import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct LockScreenRectangularWidget: Widget {
  let name: String = "LockScreenRectangularWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Next Task")
    .description("Shows your next due task.")
    .supportedFamilies([.accessoryRectangular])
  }
}
