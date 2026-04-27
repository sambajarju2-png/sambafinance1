import SwiftUI
import WidgetKit

// MARK: - Small Widget (2×2) — "Volgende betaling"
// Shows: next bill vendor + amount + countdown
// Tap → opens app to Overzicht

struct SmallWidgetView: View {
    let data: WidgetData
    @Environment(\.colorScheme) var colorScheme

    private var bg: Color {
        colorScheme == .dark ? PayWatchColors.bgDark : .white
    }

    private var cardBg: Color {
        colorScheme == .dark ? PayWatchColors.surfaceDark : PayWatchColors.bgLight
    }

    var body: some View {
        ZStack {
            // Background
            ContainerRelativeShape()
                .fill(bg)

            if let bill = data.nextBill {
                VStack(alignment: .leading, spacing: 6) {
                    // Header row: logo + overdue badge
                    HStack {
                        // PayWatch mark
                        Text("PW")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(.white)
                            .frame(width: 22, height: 22)
                            .background(PayWatchColors.blue)
                            .cornerRadius(6)

                        Spacer()

                        // Overdue badge (only if > 0)
                        if data.overdueCount > 0 {
                            HStack(spacing: 3) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 9))
                                Text("\(data.overdueCount)")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                            }
                            .foregroundColor(PayWatchColors.red)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(PayWatchColors.red.opacity(0.12))
                            .cornerRadius(6)
                        }
                    }

                    Spacer()

                    // Countdown
                    Text(relativeDateDutch(bill.dueDate).uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(bill.daysUntil <= 1 ? PayWatchColors.amber : PayWatchColors.muted)
                        .tracking(0.5)

                    // Amount — hero number
                    Text(formatEurosShort(bill.amount))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(colorScheme == .dark ? .white : PayWatchColors.text)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                        .privacySensitive()

                    // Vendor + stage dot
                    HStack(spacing: 4) {
                        Circle()
                            .fill(stageColor(bill.stage))
                            .frame(width: 6, height: 6)
                        Text(bill.vendor)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(PayWatchColors.muted)
                            .lineLimit(1)
                    }
                }
                .padding(14)
            } else {
                // Empty state
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(PayWatchColors.green)
                    Text("Geen openstaande\nrekeningen")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(PayWatchColors.muted)
                        .multilineTextAlignment(.center)
                }
                .padding(14)
            }
        }
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }
}

// MARK: - Preview

struct SmallWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        SmallWidgetView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .previewDisplayName("Small — Light")

        SmallWidgetView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .environment(\.colorScheme, .dark)
            .previewDisplayName("Small — Dark")
    }
}
