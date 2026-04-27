//
//  PayWatchWidgetControl.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Control Center Widget (iOS 18+)
// Adds a "Scan Rekening" button to Control Center
// Tapping it opens PayWatch directly to the camera scanner

@available(iOS 18.0, *)
struct PayWatchWidgetControl: ControlWidget {
    static let kind: String = "nl.paywatch.app.ScanControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenScannerIntent()) {
                Label("Scan Rekening", systemImage: "camera.viewfinder")
            }
        }
        .displayName("PayWatch Scan")
        .description("Open de rekening scanner")
    }
}

// MARK: - Open Scanner Intent

@available(iOS 18.0, *)
struct OpenScannerIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Scanner"
    static var description: IntentDescription = IntentDescription("Open PayWatch rekening scanner")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        // The deep link will be handled by the Capacitor app
        // nl.paywatch.app://scan opens the camera scan page
        return .result()
    }
}

// MARK: - Quick Status Control (shows overdue count)

@available(iOS 18.0, *)
struct PayWatchStatusControl: ControlWidget {
    static let kind: String = "nl.paywatch.app.StatusControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenAppIntent()) {
                let data = loadControlData()
                Label {
                    Text(data.overdueCount > 0 ? "\(data.overdueCount) achterstallig" : "Op tijd")
                } icon: {
                    Image(systemName: data.overdueCount > 0 ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                }
            }
        }
        .displayName("PayWatch Status")
        .description("Snelle status van je rekeningen")
    }
}

@available(iOS 18.0, *)
struct OpenAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Open PayWatch"
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// Helper to read data for control widgets
@available(iOS 18.0, *)
private func loadControlData() -> (overdueCount: Int, upcomingCount: Int) {
    let defaults = UserDefaults(suiteName: "group.nl.paywatch.app")
    guard let jsonString = defaults?.string(forKey: "widget_data"),
          let jsonData = jsonString.data(using: .utf8) else {
        return (0, 0)
    }
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    if let data = try? decoder.decode(WidgetData.self, from: jsonData) {
        return (data.overdueCount, data.upcomingCount)
    }
    return (0, 0)
}
