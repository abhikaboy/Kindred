import WidgetKit
import SwiftUI
internal import ExpoWidgets

@main
struct ExportWidgets0: WidgetBundle {
  var body: some Widget {
    TodayTasksWidget()
	WorkspaceSnapshotWidget()
	ActivityStreakWidget()
	LockScreenCircularWidget()
    ExportWidgets1().body
  }
}

struct ExportWidgets1: WidgetBundle {
  var body: some Widget {
    LockScreenRectangularWidget()
	LockScreenInlineWidget()
    WidgetLiveActivity()
  }
}
