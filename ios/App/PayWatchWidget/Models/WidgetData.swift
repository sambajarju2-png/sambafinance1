import Foundation

// MARK: - Widget Data Model
// Matches the JSON payload written from the web app via WidgetBridge
// All monetary values are in euro CENTS (integer)

struct WidgetData: Codable {
    let updatedAt: String
    let outstandingAmount: Int       // cents
    let overdueCount: Int
    let upcomingCount: Int
    let paidAmount: Int              // cents
    let bankIncome: Int              // cents
    let bankExpenses: Int            // cents
    let net: Int                     // cents
    let disposable: Int              // cents
    let nextBill: NextBill?
    let upcomingBills: [BillSummary]
    let subscriptionTotalMonthly: Int // cents
    let debtFreeMonths: Int?

    struct NextBill: Codable {
        let id: String?              // Supabase bill UUID
        let vendor: String
        let amount: Int              // cents
        let dueDate: String          // "2026-05-01"
        let daysUntil: Int
        let stage: String
    }

    struct BillSummary: Codable {
        let id: String?              // Supabase bill UUID
        let vendor: String
        let amount: Int              // cents
        let dueDate: String
        let stage: String
    }

    // Check if this is placeholder data (never written by the app)
    var isPlaceholder: Bool {
        return updatedAt == "2026-04-27T09:00:00Z" && outstandingAmount == 98174
    }
}

// MARK: - Placeholder Data (for widget gallery preview + empty state)

extension WidgetData {
    static let placeholder = WidgetData(
        updatedAt: "2026-04-27T09:00:00Z",
        outstandingAmount: 98174,
        overdueCount: 2,
        upcomingCount: 3,
        paidAmount: 64970,
        bankIncome: 463700,
        bankExpenses: 395400,
        net: 68300,
        disposable: 145604,
        nextBill: NextBill(
            id: nil,
            vendor: "Eneco",
            amount: 21600,
            dueDate: "2026-05-01",
            daysUntil: 4,
            stage: "factuur"
        ),
        upcomingBills: [
            BillSummary(id: nil, vendor: "Eneco", amount: 21600, dueDate: "2026-05-01", stage: "factuur"),
            BillSummary(id: nil, vendor: "KPN", amount: 8900, dueDate: "2026-05-03", stage: "factuur"),
            BillSummary(id: nil, vendor: "CJIB", amount: 35000, dueDate: "2026-05-10", stage: "aanmaning")
        ],
        subscriptionTotalMonthly: 137400,
        debtFreeMonths: 6
    )
}
