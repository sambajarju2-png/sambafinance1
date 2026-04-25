import Capacitor
import WebKit

/// Enables the native iOS swipe-back gesture on WKWebView.
/// This gives real UIKit parallax, rubber-banding, and velocity handling
/// without any JavaScript overhead.
@objc(SwipeBackPlugin)
public class SwipeBackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SwipeBackPlugin"
    public let jsName = "SwipeBack"
    public let pluginMethods: [CAPPluginMethod] = []

    override public func load() {
        DispatchQueue.main.async { [weak self] in
            if let webView = self?.bridge?.webView {
                webView.allowsBackForwardNavigationGestures = true
            }
        }
    }
}
