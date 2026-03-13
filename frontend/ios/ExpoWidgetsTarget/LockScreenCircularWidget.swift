import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct LockScreenCircularWidget: Widget {
  let name: String = "LockScreenCircularWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Today Progress")
    .description("Circular progress ring for today's tasks.")
    .supportedFamilies([.accessoryCircular])
  }
}
