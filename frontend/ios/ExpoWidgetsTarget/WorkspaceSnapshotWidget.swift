import WidgetKit
import SwiftUI

struct WorkspaceSnapshotWidget: Widget {
  let name: String = "WorkspaceSnapshotWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: KindredProvider(kind: name, sample: KindredSamples.workspace)) { entry in
      WorkspaceSnapshotView(entry: entry)
    }
    .configurationDisplayName("Busiest Workspace")
    .description("Open tasks in the workspace that needs you most.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .containerBackgroundRemovable(false)
  }
}

struct WorkspaceSnapshotView: View {
  let entry: KindredEntry<WorkspacePayload>
  /// Lets previews and snapshot renders pick a size; WidgetKit's value is read-only.
  var familyOverride: WidgetFamily? = nil
  @Environment(\.widgetFamily) private var environmentFamily
  private var family: WidgetFamily { familyOverride ?? environmentFamily }
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    Group {
      if let workspace = entry.payload {
        if family == .systemSmall { small(workspace) } else { medium(workspace) }
      } else {
        NotSyncedView()
      }
    }
    .widgetURL(KindredLinks.home)
    .kindredBackground(scheme, motif: entry.payload == nil ? .none : .workspace, tint: entry.payload.map(accent) ?? KindredPalette.brand)
  }

  private func accent(_ workspace: WorkspacePayload) -> Color {
    Color(hexString: workspace.workspaceColor) ?? KindredPalette.brand
  }

  private func title(_ workspace: WorkspacePayload) -> some View {
    HStack(spacing: 6) {
      RoundedRectangle(cornerRadius: 3)
        .fill(accent(workspace))
        .frame(width: 10, height: 10)
        .widgetAccentable()
      Text(workspace.workspaceName)
        .font(.outfit(13, .semibold))
        .lineLimit(1)
    }
  }

  private func count(_ workspace: WorkspacePayload, size: CGFloat) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("\(workspace.pendingCount)")
        .font(.kindredDisplay(size))
        .monospacedDigit()
      HStack(spacing: 6) {
        Text(workspace.pendingCount == 1 ? "open task" : "open tasks")
          .foregroundStyle(KindredPalette.caption)
      }
      .font(.outfit(11, .medium))
      .lineLimit(1)
    }
  }

  private func small(_ workspace: WorkspacePayload) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      title(workspace)
      Spacer(minLength: 0)
      count(workspace, size: 40)
      if let next = workspace.tasks.first {
        Text(next.title)
          .font(.outfit(12, .medium))
          .foregroundStyle(KindredPalette.caption)
          .lineLimit(1)
          .padding(.top, 8)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func medium(_ workspace: WorkspacePayload) -> some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        title(workspace)
        Spacer(minLength: 0)
        count(workspace, size: 36)
      }
      .frame(width: 104, alignment: .leading)
      .frame(maxHeight: .infinity, alignment: .topLeading)

      if workspace.tasks.isEmpty {
        VStack(alignment: .leading, spacing: 4) {
          Image(systemName: "checkmark.seal.fill")
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(KindredPalette.success(scheme))
          Text("Nothing open")
            .font(.kindredDisplay(17))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
TaskList(tasks: workspace.tasks, total: workspace.pendingCount, limit: 3, now: entry.date, accent: accent(workspace))
      }
    }
  }
}
