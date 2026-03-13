import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct WorkspaceSnapshotWidget: Widget {
  let name: String = "WorkspaceSnapshotWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Workspace")
    .description("A quick look at your workspace tasks.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
