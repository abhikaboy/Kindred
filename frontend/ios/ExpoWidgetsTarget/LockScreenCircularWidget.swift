import WidgetKit
import SwiftUI

struct LockScreenCircularWidget: Widget {
  let name: String = "LockScreenCircularWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.today)) { entry in
      LockScreenCircularView(entry: entry)
    }
    .configurationDisplayName("Today Progress")
    .description("A ring that fills as you finish today's tasks.")
    .supportedFamilies([.accessoryCircular])
  }
}

struct LockScreenCircularView: View {
  let entry: KindredEntry<TodayPayload>

  var body: some View {
    let today = entry.payload
    Gauge(value: today?.progress ?? 0) {
      Image(systemName: "checkmark")
    } currentValueLabel: {
      if let today, today.allDone {
        Image(systemName: "checkmark")
          .font(.system(size: 16, weight: .bold))
      } else {
        Text("\(today?.remainingCount ?? 0)")
          .font(.outfit(20, .semibold))
          .monospacedDigit()
      }
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .widgetURL(KindredLinks.today)
    .accessoryBackground()
  }
}
