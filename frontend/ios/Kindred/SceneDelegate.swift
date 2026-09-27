import React
import UIKit

/// Hosts the React Native root view in a UIWindowScene.
///
/// iOS 26 made UIScene lifecycle adoption mandatory for apps linked against
/// that SDK or newer: a UIApplicationDelegate that creates its own UIWindow
/// now traps at launch inside
/// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption. Window
/// ownership therefore lives here rather than in AppDelegate, which keeps only
/// the non-UI callbacks (remote notification registration, app-level lifecycle)
/// that scenes do not replace.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Keep the delegate's reference in sync; some React Native and Expo code
    // still reaches for `UIApplication.shared.delegate.window`.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions
    )

    // A cold launch from a deep link delivers the URL here rather than through
    // the AppDelegate's open-url callback.
    if let urlContext = connectionOptions.urlContexts.first {
      RCTLinkingManager.application(
        UIApplication.shared,
        open: urlContext.url,
        options: [:]
      )
    }
    if let userActivity = connectionOptions.userActivities.first {
      RCTLinkingManager.application(
        UIApplication.shared,
        continue: userActivity,
        restorationHandler: { _ in }
      )
    }
  }

  // Deep links delivered while the app is already running.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else {
      return
    }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  // Universal links delivered while the app is already running.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
