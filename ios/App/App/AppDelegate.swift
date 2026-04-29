import UIKit
import Capacitor
import WebKit
import BackgroundTasks
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    static let bgTaskIdentifier = "nl.paywatch.app.widget-refresh"
    static let suiteName = "group.nl.paywatch.app"

    private var widgetBridgeInjected = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
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

    // --- Widget Bridge via WKScriptMessageHandler ---

    private func injectWidgetBridge() {
        guard !widgetBridgeInjected else { return }

        guard let rootVC = self.window?.rootViewController,
              let bridgeVC = rootVC as? CAPBridgeViewController,
              let webView = bridgeVC.webView else {
            print("[WidgetBridge] WebView not ready yet")
            return
        }

        let handler = WidgetMessageHandler()
        webView.configuration.userContentController.add(handler, name: "widgetData")
        webView.configuration.userContentController.add(handler, name: "widgetClear")
        webView.configuration.userContentController.add(handler, name: "widgetAuth")

        let js = """
        window.PayWatchNativeBridge = {
            updateWidgetData: function(jsonString) {
                window.webkit.messageHandlers.widgetData.postMessage(jsonString);
            },
            clearWidgetData: function() {
                window.webkit.messageHandlers.widgetClear.postMessage("clear");
            },
            storeAuthToken: function(token) {
                window.webkit.messageHandlers.widgetAuth.postMessage(token);
            }
        };
        console.log('[WidgetBridge] Native bridge injected');
        """
        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                print("[WidgetBridge] JS injection error: \(error)")
            } else {
                print("[WidgetBridge] JS bridge injected successfully")
            }
        }

        widgetBridgeInjected = true
        print("[WidgetBridge] Message handlers registered")
    }

    // --- Background Widget Refresh ---

    private func handleWidgetRefresh(task: BGAppRefreshTask) {
        scheduleWidgetRefresh()
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        Self.performBackgroundRefresh { success in
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

    static func performBackgroundRefresh(completion: @escaping (Bool) -> Void) {
        let defaults = UserDefaults(suiteName: suiteName)
        guard let token = defaults?.string(forKey: "widget_auth_token"),
              let apiBase = defaults?.string(forKey: "widget_api_base"),
              let url = URL(string: "\(apiBase)/api/widget/data") else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 25

        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  let jsonString = String(data: data, encoding: .utf8),
                  (try? JSONSerialization.jsonObject(with: data)) != nil else {
                completion(false)
                return
            }
            defaults?.set(jsonString, forKey: "widget_data")
            defaults?.set(Date().timeIntervalSince1970, forKey: "widget_data_updated_at")
            defaults?.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
            completion(true)
        }.resume()
    }

    // --- Debug ---
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Inject widget bridge on first activation (webview is ready by now)
        injectWidgetBridge()

        let defaults = UserDefaults(suiteName: Self.suiteName)
        let hasData = defaults?.string(forKey: "widget_data") != nil
        print("[Widget Debug] App Group accessible: \(defaults != nil)")
        print("[Widget Debug] widget_data exists: \(hasData)")
    }

    // --- Push Notifications ---
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {
        scheduleWidgetRefresh()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// --- WKScriptMessageHandler - receives data from web app ---

class WidgetMessageHandler: NSObject, WKScriptMessageHandler {

    let suiteName = "group.nl.paywatch.app"

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {

        case "widgetData":
            guard let jsonString = message.body as? String else {
                print("[WidgetBridge] ERROR: widgetData body is not a string")
                return
            }
            guard let data = jsonString.data(using: .utf8),
                  (try? JSONSerialization.jsonObject(with: data)) != nil else {
                print("[WidgetBridge] ERROR: Invalid JSON")
                return
            }
            let defaults = UserDefaults(suiteName: suiteName)
            defaults?.set(jsonString, forKey: "widget_data")
            defaults?.set(Date().timeIntervalSince1970, forKey: "widget_data_updated_at")
            defaults?.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
            print("[WidgetBridge] SUCCESS: Wrote \(jsonString.count) chars -> reloading timelines")

        case "widgetClear":
            let defaults = UserDefaults(suiteName: suiteName)
            defaults?.removeObject(forKey: "widget_data")
            defaults?.removeObject(forKey: "widget_data_updated_at")
            defaults?.removeObject(forKey: "widget_auth_token")
            defaults?.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
            print("[WidgetBridge] Cleared widget data")

        case "widgetAuth":
            guard let token = message.body as? String else { return }
            let defaults = UserDefaults(suiteName: suiteName)
            defaults?.set(token, forKey: "widget_auth_token")
            defaults?.set("https://app.paywatch.app", forKey: "widget_api_base")
            defaults?.synchronize()
            print("[WidgetBridge] Auth token stored")

        default:
            break
        }
    }
}
