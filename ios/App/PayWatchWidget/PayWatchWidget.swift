import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
// Reads cached JSON from App Groups UserDefaults (written by Capacitor plugin)
// No network calls here — data comes from the web app

struct PayWatchWidgetProvider: TimelineProvider {
    typealias Entry = PayWatchEntry

    // MARK: Placeholder (widget gallery shimmer)
    func placeholder(in context: Context) -> PayWatchEntry {
        PayWatchEntry(date: Date(), data: .placeholder)
    }

    // MARK: Snapshot (widget gallery preview)
    func getSnapshot(in context: Context, completion: @escaping (PayWatchEntry) -> Void) {
        let data = loadWidgetData() ?? .placeholder
        completion(PayWatchEntry(date: Date(), data: data))
    }

    // MARK: Timeline (actual widget updates)
    func getTimeline(in context: Context, completion: @escaping (Timeline<PayWatchEntry>) -> Void) {
        let data = loadWidgetData() ?? .placeholder
        let entry = PayWatchEntry(date: Date(), data: data)

        // Refresh every 30 minutes OR when the app triggers reloadAllTimelines()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))

        completion(timeline)
    }

    // MARK: Load from App Groups
    private func loadWidgetData() -> WidgetData? {
        let defaults = UserDefaults(suiteName: "group.nl.paywatch.app")
        guard let jsonString = defaults?.string(forKey: "widget_data"),
              let jsonData = jsonString.data(using: .utf8) else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try? decoder.decode(WidgetData.self, from: jsonData)
    }
}

// MARK: - Widget View Router

struct PayWatchWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: PayWatchEntry

    var body: some View {
        switch family {
        // Home Screen
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)

        // Lock Screen
        case .accessoryRectangular:
            LockScreenRectangularView(data: entry.data)
        case .accessoryCircular:
            LockScreenCircularView(data: entry.data)
        case .accessoryInline:
            LockScreenInlineView(data: entry.data)

        default:
            // Fallback for unsupported families
            Text("PayWatch")
                .font(.caption)
        }
    }
}

// MARK: - Widget Configuration

struct PayWatchWidget: Widget {
    let kind: String = "nl.paywatch.widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: PayWatchWidgetProvider()
        ) { entry in
            if #available(iOS 17.0, *) {
                PayWatchWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                PayWatchWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("PayWatch")
        .description("Bekijk je openstaande rekeningen en volgende betaling")
        .supportedFamilies([
            // Home Screen
            .systemSmall,
            .systemMedium,
            // Lock Screen (iOS 16+)
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline
        ])
    }
}
