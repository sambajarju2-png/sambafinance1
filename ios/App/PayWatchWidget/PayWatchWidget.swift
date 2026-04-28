//
//  PayWatchWidget.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import WidgetKit
import SwiftUI

// MARK: - Configurable Timeline Provider
// Uses AppIntentTimelineProvider so users can choose Bills vs Budget mode

struct PayWatchWidgetProvider: AppIntentTimelineProvider {
    typealias Entry = PayWatchEntry
    typealias Intent = PayWatchWidgetConfigIntent

    // Widget gallery shimmer
    func placeholder(in context: Context) -> PayWatchEntry {
        PayWatchEntry(date: Date(), data: .placeholder, mode: .bills)
    }

    // Widget gallery preview
    func snapshot(for configuration: PayWatchWidgetConfigIntent, in context: Context) async -> PayWatchEntry {
        let data = loadWidgetData() ?? .placeholder
        return PayWatchEntry(date: Date(), data: data, mode: configuration.mode)
    }

    // Actual timeline for the live widget
    func timeline(for configuration: PayWatchWidgetConfigIntent, in context: Context) async -> Timeline<PayWatchEntry> {
        let data = loadWidgetData() ?? .placeholder
        let entry = PayWatchEntry(date: Date(), data: data, mode: configuration.mode)

        // Refresh every 30 min or when app triggers reloadAllTimelines()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        return Timeline(entries: [entry], policy: .after(nextRefresh))
    }

    // Read from App Groups shared container
    private func loadWidgetData() -> WidgetData? {
        let defaults = UserDefaults(suiteName: "group.nl.paywatch.app")
        guard let jsonString = defaults?.string(forKey: "widget_data"),
              let jsonData = jsonString.data(using: .utf8) else {
            print("[Widget] loadWidgetData: NO DATA in App Group")
            return nil
        }
        print("[Widget] loadWidgetData: Found \(jsonString.count) chars")
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            let data = try decoder.decode(WidgetData.self, from: jsonData)
            print("[Widget] loadWidgetData: Decoded OK — outstanding=\(data.outstandingAmount) overdue=\(data.overdueCount)")
            return data
        } catch {
            print("[Widget] loadWidgetData: DECODE FAILED — \(error)")
            return nil
        }
    }
}

// MARK: - Timeline Entry (now includes mode)

struct PayWatchEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
    let mode: WidgetMode
}

// MARK: - View Router

struct PayWatchWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: PayWatchEntry

    var body: some View {
        switch family {
        // Home Screen
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            if entry.mode == .budget {
                BudgetMediumWidgetView(data: entry.data)
            } else {
                MediumWidgetView(data: entry.data)
            }
        case .systemLarge:
            LargeWidgetView(data: entry.data, mode: entry.mode)

        // Lock Screen
        case .accessoryRectangular:
            LockScreenRectangularView(data: entry.data)
        case .accessoryCircular:
            LockScreenCircularView(data: entry.data)
        case .accessoryInline:
            LockScreenInlineView(data: entry.data)

        default:
            Text("PayWatch")
                .font(.caption)
        }
    }
}

// MARK: - Widget Configuration

struct PayWatchWidget: Widget {
    let kind: String = "nl.paywatch.widget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: PayWatchWidgetConfigIntent.self,
            provider: PayWatchWidgetProvider()
        ) { entry in
            PayWatchWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("PayWatch")
        .description("Bekijk je rekeningen en financieel overzicht")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline
        ])
    }
}
