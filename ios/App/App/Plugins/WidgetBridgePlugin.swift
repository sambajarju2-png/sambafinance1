import Capacitor
import WidgetKit

// MARK: - WidgetBridge Capacitor Plugin
// Purpose: Bridge between the web app (WKWebView) and the Widget Extension
// The web app calls WidgetBridge.updateWidgetData({ data: jsonString })
// This plugin writes the JSON to App Groups UserDefaults
// The Widget Extension reads it via the same suite name

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearWidgetData", returnType: CAPPluginReturnPromise)
    ]

    private let suiteName = "group.nl.paywatch.app"
    private let dataKey = "widget_data"
    private let updatedAtKey = "widget_data_updated_at"

    // MARK: - Update Widget Data
    // Called from JS after data loads from Supabase
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("data") else {
            call.reject("Missing 'data' parameter — expected JSON string")
            return
        }

        // Validate JSON before storing
        guard let jsonData = jsonString.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: jsonData)) != nil else {
            call.reject("Invalid JSON string")
            return
        }

        guard let defaults = UserDefaults(suiteName: suiteName) else {
            call.reject("Could not access App Group: \(suiteName)")
            return
        }

        // Write to shared container
        defaults.set(jsonString, forKey: dataKey)
        defaults.set(Date().timeIntervalSince1970, forKey: updatedAtKey)
        defaults.synchronize()

        // Tell WidgetKit to refresh all timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve(["success": true])
    }

    // MARK: - Clear Widget Data
    // Called on logout to remove sensitive data from the widget
    @objc func clearWidgetData(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            call.reject("Could not access App Group: \(suiteName)")
            return
        }

        defaults.removeObject(forKey: dataKey)
        defaults.removeObject(forKey: updatedAtKey)
        defaults.synchronize()

        // Refresh widgets (will show empty/placeholder state)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve(["success": true])
    }
}
