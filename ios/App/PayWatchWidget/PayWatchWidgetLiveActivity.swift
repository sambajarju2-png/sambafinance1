//
//  PayWatchWidgetLiveActivity.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Live Activity Attributes
// Future: track bill payment progress in Dynamic Island
// e.g. "Betaling aan Eneco — verwerkt..."

struct PayWatchWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: String      // "processing", "completed", "failed"
        var vendor: String
        var amountCents: Int
    }

    var billId: String
    var vendor: String
}

// MARK: - Live Activity Widget

struct PayWatchWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PayWatchWidgetAttributes.self) { context in
            // Lock screen / notification banner
            HStack(spacing: 12) {
                // Status icon
                Image(systemName: statusIcon(context.state.status))
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(statusColor(context.state.status))

                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.vendor)
                        .font(.system(size: 14, weight: .semibold))
                    Text(statusText(context.state.status))
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text(formatLiveActivityAmount(context.state.amountCents))
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(statusColor(context.state.status))
            }
            .padding(16)
            .activityBackgroundTint(Color(red: 0.039, green: 0.145, blue: 0.251)) // Navy
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: statusIcon(context.state.status))
                        .foregroundColor(statusColor(context.state.status))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatLiveActivityAmount(context.state.amountCents))
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.state.vendor) — \(statusText(context.state.status))")
                        .font(.system(size: 13))
                }
            } compactLeading: {
                Image(systemName: statusIcon(context.state.status))
                    .foregroundColor(statusColor(context.state.status))
            } compactTrailing: {
                Text(formatLiveActivityAmount(context.state.amountCents))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
            } minimal: {
                Image(systemName: statusIcon(context.state.status))
                    .foregroundColor(statusColor(context.state.status))
            }
            .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
        }
    }
}

// MARK: - Helpers

private func statusIcon(_ status: String) -> String {
    switch status {
    case "processing": return "arrow.triangle.2.circlepath"
    case "completed":  return "checkmark.circle.fill"
    case "failed":     return "xmark.circle.fill"
    default:           return "creditcard.fill"
    }
}

private func statusColor(_ status: String) -> Color {
    switch status {
    case "processing": return .orange
    case "completed":  return Color(red: 0.020, green: 0.588, blue: 0.412) // green
    case "failed":     return Color(red: 0.863, green: 0.149, blue: 0.149) // red
    default:           return .blue
    }
}

private func statusText(_ status: String) -> String {
    switch status {
    case "processing": return "Wordt verwerkt..."
    case "completed":  return "Betaald"
    case "failed":     return "Mislukt"
    default:           return "Bezig..."
    }
}

private func formatLiveActivityAmount(_ cents: Int) -> String {
    let euros = cents / 100
    return "€ \(euros)"
}
