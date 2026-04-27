import SwiftUI
import WidgetKit

// MARK: - Lock Screen Widget (.accessoryRectangular)
// Compact one-liner: next bill or overdue alert
// Privacy-safe: uses .privacySensitive() on amounts
// Also works in StandBy mode on iOS 17+

struct LockScreenRectangularView: View {
    let data: WidgetData

    var body: some View {
        // Priority: show overdue alert if any, otherwise next bill
        if data.overdueCount > 0 {
            overdueAlert
        } else if let bill = data.nextBill {
            nextBillView(bill)
        } else {
            allClearView
        }
    }

    // MARK: - Overdue Alert

    private var overdueAlert: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 11, weight: .semibold))
                Text("\(data.overdueCount) achterstallig")
                    .font(.system(size: 13, weight: .bold))
                    .widgetAccentable()
            }

            if let bill = data.nextBill {
                Text("Volgende: \(bill.vendor) · \(relativeDateDutch(bill.dueDate))")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            } else {
                Text("\(data.overdueCount) rekeningen hebben aandacht nodig")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }

    // MARK: - Next Bill

    private func nextBillView(_ bill: WidgetData.NextBill) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "creditcard.fill")
                    .font(.system(size: 11))
                Text("PayWatch")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 0) {
                Text(bill.vendor)
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)

                Text(" · ")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.secondary)

                Text(formatEurosShort(bill.amount))
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .widgetAccentable()
                    .privacySensitive()
            }

            Text(relativeDateDutch(bill.dueDate))
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }

    // MARK: - All Clear

    private var allClearView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 11))
                Text("PayWatch")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
            }

            Text("Alles op tijd betaald")
                .font(.system(size: 13, weight: .bold))
                .widgetAccentable()

            if let months = data.debtFreeMonths, months > 0 {
                Text("Schuldenvrij over ~\(months) maanden")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }
}

// MARK: - Lock Screen Circular (bonus — minimal)

struct LockScreenCircularView: View {
    let data: WidgetData

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()

            if data.overdueCount > 0 {
                // Overdue count
                VStack(spacing: 1) {
                    Text("\(data.overdueCount)")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .widgetAccentable()
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
            } else {
                // Upcoming count
                VStack(spacing: 1) {
                    Text("\(data.upcomingCount)")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                    Image(systemName: "creditcard.fill")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
            }
        }
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }
}

// MARK: - Lock Screen Inline (bonus — single line for Watch/StandBy)

struct LockScreenInlineView: View {
    let data: WidgetData

    var body: some View {
        if data.overdueCount > 0 {
            Text("\(data.overdueCount) achterstallig")
                .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
        } else if let bill = data.nextBill {
            Text("\(bill.vendor) \(formatEurosShort(bill.amount)) · \(relativeDateDutch(bill.dueDate))")
                .privacySensitive()
                .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
        } else {
            Text("Alles betaald")
                .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
        }
    }
}

// MARK: - Previews

struct LockScreenWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        LockScreenRectangularView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .accessoryRectangular))
            .previewDisplayName("Lock — Rectangular")

        LockScreenCircularView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .accessoryCircular))
            .previewDisplayName("Lock — Circular")

        LockScreenInlineView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .accessoryInline))
            .previewDisplayName("Lock — Inline")
    }
}
