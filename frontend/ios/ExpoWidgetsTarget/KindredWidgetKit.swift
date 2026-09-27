import SwiftUI
import WidgetKit

// Shared pieces for Kindred's native widgets. Payloads are written from JS by
// widgets/syncWidgets.ts (shapes in widgets/widgetData.ts) via expo-widgets.

// MARK: - Palette

enum KindredPalette {
  static let brand = Color(hex: 0x854DFF)
  static let brandSoft = Color(hex: 0xB89BFF)
  static let overdue = Color(hex: 0xFF5C5F)
  static let caption = Color(hex: 0x919090)
  static let ink = Color(hex: 0x13121F)

  // Mirrors constants/Colors.ts so widgets read as the same product as the app
  static func background(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? Color(hex: 0x0C0C1A) : .white
  }

  static func success(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? Color(hex: 0x5CFF95) : Color(hex: 0x1CF954)
  }

  static func warning(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? Color(hex: 0xFFFF5C) : Color(hex: 0xFFD700)
  }

  static func track(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? Color(hex: 0x1F1D2E) : Color(hex: 0xE5E5E5)
  }

  /// TaskCard surface: lightenedCard fill with a tertiary hairline.
  static func card(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? Color(hex: 0x1A1929) : Color(hex: 0xFAFAFA)
  }

  static func cardBorder(_ scheme: ColorScheme) -> Color {
    track(scheme)
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }

  /// Parses "#RRGGBB" / "RRGGBB"; nil for anything else.
  init?(hexString: String) {
    let cleaned = hexString.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
    guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else { return nil }
    self.init(hex: value)
  }
}

// Outfit is bundled into the extension (UIAppFonts); weights are the variable font's named instances.
extension Font {
  static func outfit(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    let instance: String
    // One step lighter than the name suggests; the app's body type is OutfitLight
    switch weight {
    case .medium: instance = "Regular"
    case .semibold: instance = "Medium"
    case .bold, .heavy, .black: instance = "SemiBold"
    default: instance = "Light"
    }
    return .custom("Outfit-Thin_\(instance)", size: size)
  }

  static func kindredDisplay(_ size: CGFloat) -> Font {
    outfit(size, .semibold)
  }
}

// MARK: - Payloads

struct WidgetTaskPayload: Codable, Hashable, Identifiable {
  let id: String
  let title: String
  let workspace: String
  let categoryId: String
  let dueAt: Double
  let overdue: Bool
  let priority: Int

  var dueDate: Date? { dueAt > 0 ? Date(timeIntervalSince1970: dueAt / 1000) : nil }

  /// Re-evaluated at render time so a widget left alone still flags lateness.
  func isOverdue(at now: Date) -> Bool {
    overdue || (dueDate.map { $0 <= now } ?? false)
  }
}

struct TodayPayload: Codable {
  let completedCount: Int
  let remainingCount: Int
  let overdueCount: Int
  let tasks: [WidgetTaskPayload]

  var total: Int { completedCount + remainingCount }
  var progress: Double { total == 0 ? 0 : Double(completedCount) / Double(total) }
  var allDone: Bool { remainingCount == 0 && completedCount > 0 }
}

struct NextTaskPayload: Codable {
  let task: WidgetTaskPayload?
  let remainingCount: Int
}

struct WorkspacePayload: Codable {
  let workspaceName: String
  let workspaceColor: String
  let pendingCount: Int
  let overdueCount: Int
  let tasks: [WidgetTaskPayload]
}

struct StreakDayPayload: Codable, Hashable {
  let label: String
  let level: Int
  let isToday: Bool
}

struct StreakPayload: Codable {
  let streak: Int
  let completedToday: Int
  let days: [StreakDayPayload]
}

// MARK: - Timeline

struct KindredEntry<Payload>: TimelineEntry {
  let date: Date
  /// nil until the app has synced at least once.
  let payload: Payload?
}

/// Reads the timeline expo-widgets stores for `kind` in the shared app group,
/// and serves sample content in the widget gallery.
struct KindredProvider<Payload: Decodable>: TimelineProvider {
  let kind: String
  let sample: Payload

  func placeholder(in context: Context) -> KindredEntry<Payload> {
    KindredEntry(date: Date(), payload: sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (KindredEntry<Payload>) -> Void) {
    if context.isPreview {
      completion(KindredEntry(date: Date(), payload: sample))
      return
    }
    completion(currentEntry(from: storedEntries()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<KindredEntry<Payload>>) -> Void) {
    let entries = storedEntries()
    let now = Date()
    // Drop entries already superseded, keeping the one in effect right now.
    var live = entries.filter { $0.date > now }
    live.insert(currentEntry(from: entries), at: 0)
    completion(Timeline(entries: live, policy: .never))
  }

  private func currentEntry(from entries: [KindredEntry<Payload>]) -> KindredEntry<Payload> {
    let now = Date()
    let current = entries.last { $0.date <= now } ?? entries.first
    return KindredEntry(date: now, payload: current?.payload)
  }

  private func storedEntries() -> [KindredEntry<Payload>] {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
          let defaults = UserDefaults(suiteName: group),
          let raw = defaults.array(forKey: "__expo_widgets_\(kind)_timeline") as? [[String: Any]] else {
      return []
    }
    return raw.compactMap { item in
      guard let timestamp = (item["timestamp"] as? NSNumber)?.doubleValue,
            let props = item["props"],
            JSONSerialization.isValidJSONObject(props),
            let data = try? JSONSerialization.data(withJSONObject: props),
            let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
      return KindredEntry(date: Date(timeIntervalSince1970: timestamp / 1000), payload: payload)
    }
    .sorted { $0.date < $1.date }
  }
}

/// Shown before the first sync (fresh install, signed out).
struct NotSyncedView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      WidgetEyebrow(text: "Kindred")
      Spacer(minLength: 0)
      Text("Open Kindred to see your tasks here.")
        .font(.outfit(13, .medium))
        .foregroundStyle(KindredPalette.caption)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(KindredMotif(style: .empty).padding(-16))
  }
}

// MARK: - Links

enum KindredLinks {
  static let today = URL(string: "kindred:///(logged-in)/(tabs)/(task)/today")!
  static let home = URL(string: "kindred:///(logged-in)/(tabs)/(task)")!

  static func task(_ task: WidgetTaskPayload) -> URL {
    var components = URLComponents()
    components.scheme = "kindred"
    components.path = "/(logged-in)/(tabs)/(task)/task/\(task.id)"
    components.queryItems = [
      URLQueryItem(name: "categoryId", value: task.categoryId),
      URLQueryItem(name: "name", value: task.title),
    ]
    return components.url ?? home
  }
}

// MARK: - Shared views

extension View {
  /// Brand background that fills the whole widget, including content margins.
  @ViewBuilder
  func kindredBackground(_ scheme: ColorScheme, motif: KindredMotif.Style = .none, tint: Color = KindredPalette.brand) -> some View {
    let layer = ZStack {
      KindredPalette.background(scheme)
      KindredMotif(style: motif, tint: tint)
    }
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { layer }
    } else {
      padding().background(layer)
    }
  }

  @ViewBuilder
  func accessoryBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { AccessoryWidgetBackground() }
    } else {
      self
    }
  }
}

// MARK: - Shapes motif

/// The onboarding shapes (components/onboarding/BackgroundGraphics.tsx), composed per widget.
/// Mostly hairline outlines kept to the edges; at most one small solid accent.
struct KindredMotif: View {
  enum Style { case none, today, workspace, streak, empty }

  let style: Style
  var tint: Color = KindredPalette.brand
  var familyOverride: WidgetFamily? = nil
  @Environment(\.widgetFamily) private var environmentFamily
  private var family: WidgetFamily { familyOverride ?? environmentFamily }

  private var small: Bool { family == .systemSmall }

  var body: some View {
    GeometryReader { proxy in
      let w = proxy.size.width
      let h = proxy.size.height
      ZStack {
        switch style {
        case .none:
          EmptyView()
        case .today where small, .workspace where !small:
          EmptyView()
        case .today where family == .systemLarge:
          // Fills the open space beside the date header
          OutlineRing(tint: tint, opacity: 0.3)
            .frame(width: h * 0.3, height: h * 0.3)
            .position(x: w - h * 0.02, y: -h * 0.02)
          SolidDiamond(tint: tint, size: 5)
            .position(x: w - h * 0.15, y: h * 0.11)
        case .today:
          // A ring rising from the bottom edge, with a diamond on its rim
          OutlineRing(tint: tint, opacity: 0.3)
            .frame(width: h * 0.62, height: h * 0.62)
            .position(x: w - h * 0.16, y: h + h * 0.08)
          SolidDiamond(tint: tint, size: 5)
            .position(x: w - h * 0.38, y: h - h * 0.18)
        case .workspace:
          // A diamond and a dot tucked into the top corner, in the workspace's color
          OutlineDiamond(tint: tint, size: small ? 9 : 10)
            .position(x: w - 17, y: 17)
          Circle()
            .stroke(tint.opacity(0.6), lineWidth: 1)
            .frame(width: 5, height: 5)
            .position(x: w - 29, y: 27)
        case .streak:
          // A dashed orbit off the corner with the triangle riding it
          OutlineRing(tint: tint, opacity: 0.22, dash: 4)
            .frame(width: h * 0.9, height: h * 0.9)
            .position(x: w + h * 0.1, y: -h * 0.12)
          KindredTriangle()
            .stroke(tint.opacity(0.75), style: StrokeStyle(lineWidth: 1.25, lineJoin: .round))
            .frame(width: 13, height: 11.5)
            .rotationEffect(.degrees(-8))
            .position(x: w - 20, y: h * 0.33)
        case .empty:
          HStack(spacing: 6) {
            OutlineRing(tint: tint, opacity: 0.6).frame(width: 9, height: 9)
            KindredTriangle()
              .stroke(tint.opacity(0.6), style: StrokeStyle(lineWidth: 1, lineJoin: .round))
              .frame(width: 10, height: 9)
            OutlineDiamond(tint: tint, size: 7)
          }
          .position(x: w - 38, y: 20)
        }
      }
    }
    .allowsHitTesting(false)
  }
}

private struct OutlineRing: View {
  let tint: Color
  var opacity: Double = 0.4
  var dash: CGFloat? = nil

  var body: some View {
    Circle()
      .stroke(tint.opacity(opacity), style: StrokeStyle(lineWidth: 1, dash: dash.map { [$0, $0] } ?? []))
  }
}

private struct OutlineDiamond: View {
  let tint: Color
  let size: CGFloat

  var body: some View {
    RoundedRectangle(cornerRadius: 1.5)
      .stroke(tint.opacity(0.75), lineWidth: 1.25)
      .frame(width: size, height: size)
      .rotationEffect(.degrees(45))
  }
}

private struct SolidDiamond: View {
  let tint: Color
  let size: CGFloat

  var body: some View {
    RoundedRectangle(cornerRadius: 1)
      .fill(tint)
      .frame(width: size, height: size)
      .rotationEffect(.degrees(45))
  }
}

/// The motif's rounded triangle, traced from the onboarding SVG path.
struct KindredTriangle: Shape {
  func path(in rect: CGRect) -> Path {
    // Source path spans x 8...78, y 7.4...69.7
    let sx = rect.width / 70, sy = rect.height / 62.3
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + (x - 8) * sx, y: rect.minY + (y - 7.4) * sy) }
    var path = Path()
    path.move(to: p(35.16, 9.74))
    path.addCurve(to: p(40.28, 9.23), control1: p(36.12, 7.69), control2: p(38.92, 7.41))
    path.addLine(to: p(76.84, 58.41))
    path.addCurve(to: p(74.73, 63.19), control1: p(78.23, 60.28), control2: p(77.05, 62.95))
    path.addLine(to: p(12.02, 69.43))
    path.addCurve(to: p(9.01, 65.16), control1: p(9.70, 69.66), control2: p(8.01, 67.27))
    path.closeSubpath()
    return path
  }
}

/// Progress ring with a round cap, used by Today and the circular lock widget.
struct ProgressRing: View {
  let progress: Double
  let lineWidth: CGFloat
  let tint: Color
  let track: Color

  var body: some View {
    ZStack {
      Circle().stroke(track, lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0.001, min(progress, 1)))
        .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
        .widgetAccentable()
    }
  }
}

/// Section title that heads each widget, like the app's `defaultSemiBold`.
struct WidgetEyebrow: View {
  let text: String
  var systemImage: String? = nil
  var tint: Color = KindredPalette.brand

  var body: some View {
    HStack(spacing: 4) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(tint)
          .widgetAccentable()
      }
      Text(text)
        .font(.outfit(15, .semibold))
    }
  }
}

/// Compact TaskCard: card surface, title, due time, and the priority dot on the right.
struct TaskRow: View {
  let task: WidgetTaskPayload
  let now: Date
  var showWorkspace = false
  var accent: Color = KindredPalette.brand
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    TaskLink(url: KindredLinks.task(task)) {
      HStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 0) {
          Text(task.title)
            .font(.outfit(13, .medium))
            .lineLimit(1)
          if showWorkspace {
            Text(task.workspace)
              .font(.outfit(11))
              .foregroundStyle(KindredPalette.caption)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 4)
        DueLabel(task: task, now: now)
        if let dot = priorityColor {
          Circle().fill(dot).frame(width: 8, height: 8)
        }
      }
      .padding(.horizontal, 12)
      .padding(.vertical, showWorkspace ? 8 : 6)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(KindredPalette.card(scheme))
          .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .strokeBorder(KindredPalette.cardBorder(scheme), lineWidth: 1)
          )
      )
    }
  }

  // Same mapping as TaskCard's priority dot
  private var priorityColor: Color? {
    switch task.priority {
    case 1: return KindredPalette.success(scheme)
    case 2: return KindredPalette.warning(scheme)
    case 3: return KindredPalette.overdue
    default: return nil
    }
  }
}

/// Link that the offscreen preview harness (built with -D WIDGET_RENDER) can draw.
struct TaskLink<Content: View>: View {
  let url: URL
  @ViewBuilder let content: () -> Content

  var body: some View {
    #if WIDGET_RENDER
    content()
    #else
    Link(destination: url, label: content)
    #endif
  }
}

/// Task cards pinned to the top, with the overflow count on the bottom edge so the
/// column ends level with its neighbour.
struct TaskList: View {
  let tasks: [WidgetTaskPayload]
  let total: Int
  let limit: Int
  let now: Date
  var showWorkspace = false
  var accent: Color = KindredPalette.brand

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(tasks.prefix(limit)) { task in
        TaskRow(task: task, now: now, showWorkspace: showWorkspace, accent: accent)
      }
      Spacer(minLength: 0)
      if total > min(limit, tasks.count) {
        Text("+\(total - min(limit, tasks.count)) more")
          .font(.outfit(11, .medium))
          .foregroundStyle(KindredPalette.caption)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct DueLabel: View {
  let task: WidgetTaskPayload
  let now: Date

  var body: some View {
    if task.isOverdue(at: now) {
      Text("Overdue")
        .font(.outfit(11, .semibold))
        .foregroundStyle(KindredPalette.overdue)
    } else if let due = task.dueDate {
      Text(due, style: .time)
        .font(.outfit(11, .medium))
        .monospacedDigit()
        .foregroundStyle(KindredPalette.caption)
    }
  }
}

// MARK: - Sample data (widget gallery and placeholders)

enum KindredSamples {
  private static func task(_ id: String, _ title: String, _ workspace: String, inMinutes: Double?, overdue: Bool = false) -> WidgetTaskPayload {
    let due = inMinutes.map { Date().addingTimeInterval($0 * 60).timeIntervalSince1970 * 1000 } ?? 0
    return WidgetTaskPayload(id: id, title: title, workspace: workspace, categoryId: "", dueAt: due, overdue: overdue, priority: 1)
  }

  static let tasks = [
    task("1", "Send the project brief", "Work", inMinutes: -30, overdue: true),
    task("2", "Review pull request", "Work", inMinutes: 45),
    task("3", "Call the dentist", "Personal", inMinutes: 120),
    task("4", "Evening run", "Health", inMinutes: 300),
    task("5", "Plan the weekend", "Personal", inMinutes: nil),
  ]

  static let today = TodayPayload(completedCount: 3, remainingCount: 5, overdueCount: 1, tasks: tasks)
  static let nextTask = NextTaskPayload(task: tasks[1], remainingCount: 5)
  static let workspace = WorkspacePayload(workspaceName: "Work", workspaceColor: "#854DFF", pendingCount: 7, overdueCount: 1, tasks: Array(tasks.prefix(4)))
  static let streak = StreakPayload(
    streak: 12,
    completedToday: 3,
    days: zip(["T", "W", "T", "F", "S", "S", "M"], [2, 3, 1, 4, 0, 2, 3]).enumerated().map { index, pair in
      StreakDayPayload(label: pair.0, level: pair.1, isToday: index == 6)
    }
  )
}
