import WidgetKit
import SwiftUI
import os
internal import ExpoWidgets

private let logger = Logger(subsystem: "com.kindred.kindredtsl.widgets", category: "WidgetInit")

@main
struct ExportWidgets0: WidgetBundle {
  init() {
    logger.info("ExpoWidgetsTarget: WidgetBundle init called")
  }

  var body: some Widget {
    logger.info("ExpoWidgetsTarget: Building widget body")
    return WidgetBundleBuilder.buildBlock(
      TodayTasksWidget(),
      WorkspaceSnapshotWidget(),
      ActivityStreakWidget(),
      LockScreenCircularWidget(),
      ExportWidgets1().body
    )
  }
}

struct ExportWidgets1: WidgetBundle {
  var body: some Widget {
    LockScreenRectangularWidget()
	LockScreenInlineWidget()
    WidgetLiveActivity()
  }
}
