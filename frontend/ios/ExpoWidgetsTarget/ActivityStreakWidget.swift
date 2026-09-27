import WidgetKit
import SwiftUI

struct ActivityStreakWidget: Widget {
  let name: String = "ActivityStreakWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.streak)) { entry in
      ActivityStreakView(entry: entry)
    }
    .configurationDisplayName("Streak")
    .description("Your streak and the last seven days of activity.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .containerBackgroundRemovable(false)
  }
}

struct ActivityStreakView: View {
  let entry: KindredEntry<StreakPayload>
  /// Lets previews and snapshot renders pick a size; WidgetKit's value is read-only.
  var familyOverride: WidgetFamily? = nil
  @Environment(\.widgetFamily) private var environmentFamily
  private var family: WidgetFamily { familyOverride ?? environmentFamily }
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    Group {
      if let streak = entry.payload {
        if family == .systemSmall { small(streak) } else { medium(streak) }
      } else {
        NotSyncedView()
      }
    }
    .widgetURL(KindredLinks.home)
    .kindredBackground(scheme, motif: entry.payload == nil ? .none : .streak)
  }

  private func headline(_ streak: StreakPayload, size: CGFloat) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text("\(streak.streak)")
          .font(.kindredDisplay(size))
          .monospacedDigit()
        Text(streak.streak == 1 ? "day" : "days")
          .font(.outfit(13, .medium))
          .foregroundStyle(KindredPalette.caption)
      }
      Text(todayLine(streak))
        .font(.outfit(11, .medium))
        .foregroundStyle(streak.completedToday > 0 ? KindredPalette.brand : KindredPalette.caption)
        .lineLimit(1)
    }
  }

  private func todayLine(_ streak: StreakPayload) -> String {
    if streak.completedToday == 0 {
      return streak.streak > 0 ? "Finish a task to keep it" : "Finish a task to start one"
    }
    return "\(streak.completedToday) done today"
  }

  private func small(_ streak: StreakPayload) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      WidgetEyebrow(text: "Streak", systemImage: "flame.fill")
      Spacer(minLength: 0)
      headline(streak, size: 40)
      WeekStrip(days: streak.days, scheme: scheme, height: 18)
        .padding(.top, 8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func medium(_ streak: StreakPayload) -> some View {
    HStack(alignment: .top, spacing: 20) {
      VStack(alignment: .leading, spacing: 0) {
        WidgetEyebrow(text: "Streak", systemImage: "flame.fill")
        Spacer(minLength: 0)
        headline(streak, size: 44)
      }
      .frame(maxHeight: .infinity, alignment: .topLeading)

      VStack(alignment: .leading, spacing: 6) {
        Text("Last 7 days")
          .font(.outfit(11, .medium))
          .foregroundStyle(KindredPalette.caption)
        Spacer(minLength: 0)
        WeekStrip(days: streak.days, scheme: scheme, height: 56, showLabels: true)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

/// Seven bars whose height and strength follow each day's activity level (0-4).
private struct WeekStrip: View {
  let days: [StreakDayPayload]
  let scheme: ColorScheme
  let height: CGFloat
  var showLabels = false

  var body: some View {
    HStack(alignment: .bottom, spacing: 6) {
      ForEach(Array(days.enumerated()), id: \.offset) { _, day in
        VStack(spacing: 4) {
          ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 3).fill(KindredPalette.track(scheme))
            if day.level > 0 {
              RoundedRectangle(cornerRadius: 3)
                .fill(KindredPalette.brand.opacity(0.45 + 0.1375 * Double(min(day.level, 4))))
                .frame(height: showLabels ? height * CGFloat(min(day.level, 4)) / 4 : height)
                .widgetAccentable()
            }
          }
          .frame(height: height)
          if showLabels {
            Text(day.label)
              .font(.outfit(10, day.isToday ? .bold : .medium))
              .foregroundStyle(day.isToday ? KindredPalette.brand : KindredPalette.caption)
          }
        }
        .frame(maxWidth: .infinity)
      }
    }
  }
}
