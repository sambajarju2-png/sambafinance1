import Capacitor
import WidgetKit

// MARK: - WidgetBridge Capacitor Plugin
// Bridge between the web app (WKWebView) and the Widget Extension
// Handles: data sync, auth token storage, widget clearing

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeAuthToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearWidgetData", returnType: CAPPluginReturnPromise)
    ]

    static let suiteName = "group.nl.paywatch.app"
    static let dataKey = "widget_data"
    static let updatedAtKey = "widget_data_updated_at"
    static let authTokenKey = "widget_auth_token"
    static let apiBaseKey = "widget_api_base"

    // MARK: - Update Widget Data
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("data") else {
            call.reject("Missing 'data' parameter")
            return
        }
        guard let jsonData = jsonString.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: jsonData)) != nil else {
            call.reject("Invalid JSON string")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("Could not access App Group")
            return
        }

        defaults.set(jsonString, forKey: Self.dataKey)
        defaults.set(Date().timeIntervalSince1970, forKey: Self.updatedAtKey)
        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["success": true])
    }

    // MARK: - Store Auth Token
    // Called after login so BGAppRefreshTask can fetch fresh data
    @objc func storeAuthToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Missing 'token' parameter")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("Could not access App Group")
            return
        }

        defaults.set(token, forKey: Self.authTokenKey)
        // Store API base URL for background refresh
        let apiBase = call.getString("apiBase") ?? "https://app.paywatch.app"
        defaults.set(apiBase, forKey: Self.apiBaseKey)
        defaults.synchronize()

        call.resolve(["success": true])
    }

    // MARK: - Clear Widget Data
    @objc func clearWidgetData(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("Could not access App Group")
            return
        }

        defaults.removeObject(forKey: Self.dataKey)
        defaults.removeObject(forKey: Self.updatedAtKey)
        defaults.removeObject(forKey: Self.authTokenKey)
        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["success": true])
    }

    // MARK: - Background Refresh (called from AppDelegate BGTask handler)
    static func performBackgroundRefresh(completion: @escaping (Bool) -> Void) {
        let defaults = UserDefaults(suiteName: suiteName)
        guard let token = defaults?.string(forKey: authTokenKey),
              let apiBase = defaults?.string(forKey: apiBaseKey),
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
                  let jsonString = String(data: data, encoding: .utf8) else {
                completion(false)
                return
            }

            // Validate it's valid JSON
            guard (try? JSONSerialization.jsonObject(with: data)) != nil else {
                completion(false)
                return
            }

            defaults?.set(jsonString, forKey: dataKey)
            defaults?.set(Date().timeIntervalSince1970, forKey: updatedAtKey)
            defaults?.synchronize()

            WidgetCenter.shared.reloadAllTimelines()
            completion(true)
        }.resume()
    }
}
