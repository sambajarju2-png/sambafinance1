import UIKit
import Capacitor
import BackgroundTasks
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    static let bgTaskIdentifier = "nl.paywatch.app.widget-refresh"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Capacitor 8 auto-discovers plugins via @objc + CAPBridgedPlugin conformance.
        // No manual registration needed.

        // Register background task for widget data refresh
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.bgTaskIdentifier,
            using: nil
        ) { [weak self] task in
            guard let bgTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self?.handleWidgetRefresh(task: bgTask)
        }

        return true
    }

    // ─── Background Widget Refresh ─────────────────────────

    private func handleWidgetRefresh(task: BGAppRefreshTask) {
        scheduleWidgetRefresh()
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        WidgetBridgePlugin.performBackgroundRefresh { success in
            task.setTaskCompleted(success: success)
        }
    }

    func scheduleWidgetRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.bgTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[PayWatch] BGTask scheduling failed: \(error)")
        }
    }

    // ─── Debug: verify App Groups data on each app open ─────
    func applicationDidBecomeActive(_ application: UIApplication) {
        let defaults = UserDefaults(suiteName: "group.nl.paywatch.app")
        let hasData = defaults?.string(forKey: "widget_data") != nil
        let updatedAt = defaults?.double(forKey: "widget_data_updated_at") ?? 0
        print("[Widget Debug] App Group accessible: \(defaults != nil)")
        print("[Widget Debug] widget_data exists: \(hasData)")
        if updatedAt > 0 {
            let date = Date(timeIntervalSince1970: updatedAt)
            print("[Widget Debug] Last updated: \(date)")
        }
    }

    // ─── Push Notifications ─────────────────────────────────
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        scheduleWidgetRefresh()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
