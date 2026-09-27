import WidgetKit
import SwiftUI

struct LockScreenInlineWidget: Widget {
  let name: String = "LockScreenInlineWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.streak)) { entry in
      LockScreenInlineView(entry: entry)
    }
    .configurationDisplayName("Streak")
    .description("Your current streak above the clock.")
    .supportedFamilies([.accessoryInline])
  }
}

struct LockScreenInlineView: View {
  let entry: KindredEntry<StreakPayload>

  var body: some View {
    let streak = entry.payload?.streak ?? 0
    Label(streak == 1 ? "1 day streak" : "\(streak) day streak", systemImage: "flame.fill")
      .widgetURL(KindredLinks.home)
      .accessoryBackground()
  }
}
