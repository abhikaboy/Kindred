import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct LockScreenInlineWidget: Widget {
  let name: String = "LockScreenInlineWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Streak")
    .description("Shows your current streak.")
    .supportedFamilies([.accessoryInline])
  }
}
