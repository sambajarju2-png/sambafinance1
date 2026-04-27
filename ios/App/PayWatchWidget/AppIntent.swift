//
//  AppIntent.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import AppIntents
import WidgetKit

// MARK: - Widget Display Mode
// Users long-press widget → "Edit Widget" → pick Bills or Budget view

enum WidgetMode: String, AppEnum {
    case bills = "bills"
    case budget = "budget"

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Widget Weergave"

    static var caseDisplayRepresentations: [WidgetMode: DisplayRepresentation] = [
        .bills: DisplayRepresentation(title: "Rekeningen", subtitle: "Openstaand en volgende betaling"),
        .budget: DisplayRepresentation(title: "Financieel", subtitle: "Inkomen, uitgaven, vrij besteedbaar")
    ]
}

// MARK: - Widget Configuration Intent

struct PayWatchWidgetConfigIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "PayWatch Widget"
    static var description: IntentDescription = IntentDescription("Kies wat je widget toont")

    @Parameter(title: "Weergave", default: .bills)
    var mode: WidgetMode
}

// MARK: - Mark As Paid Intent (Interactive Widget — iOS 17+)
// Updates the local App Groups cache. Full Supabase sync on next app open.

struct MarkBillAsPaidIntent: AppIntent {
    static var title: LocalizedStringResource = "Markeer als betaald"
    static var description: IntentDescription = IntentDescription("Markeer een rekening als betaald")

    @Parameter(title: "Leverancier")
    var vendor: String

    @Parameter(title: "Bedrag")
    var amountCents: Int

    init() {}

    init(vendor: String, amountCents: Int) {
        self.vendor = vendor
        self.amountCents = amountCents
    }

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.nl.paywatch.app")
        guard let jsonString = defaults?.string(forKey: "widget_data"),
              let jsonData = jsonString.data(using: .utf8) else {
            return .result()
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard var data = try? decoder.decode(MutableWidgetData.self, from: jsonData) else {
            return .result()
        }

        // Remove bill from upcoming, adjust totals
        if let idx = data.upcomingBills.firstIndex(where: { $0.vendor == vendor && $0.amount == amountCents }) {
            let bill = data.upcomingBills.remove(at: idx)
            data.outstandingAmount = max(0, data.outstandingAmount - bill.amount)
            data.upcomingCount = max(0, data.upcomingCount - 1)
            data.paidAmount += bill.amount
            data.nextBill = data.upcomingBills.first.map {
                MutableWidgetData.NextBill(vendor: $0.vendor, amount: $0.amount, dueDate: $0.dueDate, daysUntil: 0, stage: $0.stage)
            }

            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            if let updated = try? encoder.encode(data),
               let str = String(data: updated, encoding: .utf8) {
                defaults?.set(str, forKey: "widget_data")
            }
        }

        // Flag for full sync when app opens
        defaults?.set(true, forKey: "widget_needs_sync")
        defaults?.synchronize()
        WidgetCenter.shared.reloadAllTimelines()

        return .result()
    }
}

// MARK: - Mutable WidgetData for intent edits

private struct MutableWidgetData: Codable {
    var updatedAt: String
    var outstandingAmount: Int
    var overdueCount: Int
    var upcomingCount: Int
    var paidAmount: Int
    var bankIncome: Int
    var bankExpenses: Int
    var net: Int
    var disposable: Int
    var nextBill: NextBill?
    var upcomingBills: [BillSummary]
    var subscriptionTotalMonthly: Int
    var debtFreeMonths: Int?

    struct NextBill: Codable {
        let vendor: String
        let amount: Int
        let dueDate: String
        var daysUntil: Int
        let stage: String
    }

    struct BillSummary: Codable {
        let vendor: String
        let amount: Int
        let dueDate: String
        let stage: String
    }
}
