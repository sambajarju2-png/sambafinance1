import Foundation
import SwiftUI

// MARK: - Dutch Currency Formatting

/// Formats euro cents as Dutch locale string: € 1.234,56
func formatEuros(_ cents: Int) -> String {
    let euros = Double(cents) / 100.0
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "EUR"
    formatter.currencySymbol = "€"
    formatter.locale = Locale(identifier: "nl_NL")
    formatter.maximumFractionDigits = (cents % 100 == 0) ? 0 : 2
    formatter.minimumFractionDigits = (cents % 100 == 0) ? 0 : 2
    return formatter.string(from: NSNumber(value: euros)) ?? "€ 0"
}

/// Short format for small widget: "€981" or "€1.234"
func formatEurosShort(_ cents: Int) -> String {
    let euros = cents / 100
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "nl_NL")
    formatter.maximumFractionDigits = 0
    return "€\u{00A0}\(formatter.string(from: NSNumber(value: euros)) ?? "0")"
}

/// Just the number part for hero displays: "981" or "1.234"
func formatEurosNumber(_ cents: Int) -> String {
    let euros = cents / 100
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "nl_NL")
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: euros)) ?? "0"
}

// MARK: - Date Helpers

/// Parse "2026-05-01" to Date
func parseDate(_ dateString: String) -> Date? {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "nl_NL")
    return formatter.date(from: dateString)
}

/// Days until a date string, minimum 0
func daysUntil(_ dateString: String) -> Int {
    guard let date = parseDate(dateString) else { return 0 }
    let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: date)).day ?? 0
    return max(0, days)
}

/// Dutch relative date: "morgen", "over 2 dagen", "vandaag", "verlopen"
func relativeDateDutch(_ dateString: String) -> String {
    let days = daysUntil(dateString)
    switch days {
    case 0:  return "vandaag"
    case 1:  return "morgen"
    case 2...7: return "over \(days) dagen"
    default: return "over \(days) dagen"
    }
}

/// Check if widget data was updated within last 24 hours
func isDataFresh(_ updatedAt: String) -> Bool {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    // Try with fractional seconds first, then without
    guard let syncDate = formatter.date(from: updatedAt) ?? ISO8601DateFormatter().date(from: updatedAt) else {
        return false
    }
    let hours = Calendar.current.dateComponents([.hour], from: syncDate, to: Date()).hour ?? 999
    return hours < 24
}

// MARK: - Escalation Stage Colors

/// Map escalation stage to SwiftUI color (matches PayWatch design system)
func stageColor(_ stage: String) -> Color {
    switch stage.lowercased() {
    case "factuur":
        return Color(red: 0.145, green: 0.388, blue: 0.922)   // #2563EB Blue
    case "herinnering":
        return Color(red: 0.851, green: 0.467, blue: 0.024)   // #D97706 Amber
    case "aanmaning":
        return Color(red: 0.918, green: 0.345, blue: 0.047)   // #EA580C Orange
    case "incasso":
        return Color(red: 0.863, green: 0.149, blue: 0.149)   // #DC2626 Red
    case "deurwaarder":
        return Color(red: 0.600, green: 0.106, blue: 0.106)   // #991B1B Dark Red
    default:
        return Color(red: 0.392, green: 0.455, blue: 0.545)   // #64748B Muted
    }
}

/// Dutch label for escalation stage
func stageLabel(_ stage: String) -> String {
    switch stage.lowercased() {
    case "factuur":     return "Factuur"
    case "herinnering": return "Herinnering"
    case "aanmaning":   return "Aanmaning"
    case "incasso":     return "Incasso"
    case "deurwaarder": return "Deurwaarder"
    default:            return stage.capitalized
    }
}

// MARK: - Design System Colors

struct PayWatchColors {
    static let navy    = Color(red: 0.039, green: 0.145, blue: 0.251)  // #0A2540
    static let blue    = Color(red: 0.145, green: 0.388, blue: 0.922)  // #2563EB
    static let green   = Color(red: 0.020, green: 0.588, blue: 0.412)  // #059669
    static let amber   = Color(red: 0.851, green: 0.467, blue: 0.024)  // #D97706
    static let red     = Color(red: 0.863, green: 0.149, blue: 0.149)  // #DC2626
    static let purple  = Color(red: 0.486, green: 0.231, blue: 0.929)  // #7C3AED
    static let muted   = Color(red: 0.392, green: 0.455, blue: 0.545)  // #64748B
    static let border  = Color(red: 0.886, green: 0.910, blue: 0.941)  // #E2E8F0
    static let text    = Color(red: 0.059, green: 0.090, blue: 0.165)  // #0F172A

    // Widget backgrounds
    static let bgLight = Color(red: 0.957, green: 0.969, blue: 0.984)  // #F4F7FB
    static let bgDark  = Color(red: 0.059, green: 0.090, blue: 0.165)  // #0F172A
    static let surfaceDark = Color(red: 0.118, green: 0.161, blue: 0.231) // #1E293B
}
