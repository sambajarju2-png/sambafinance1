import SwiftUI
import WidgetKit

// MARK: - Medium Widget (4×2) — "Betalingsoverzicht"
// Top row: Outstanding total + Overdue count
// Bottom row: Next bill with vendor, amount, countdown, stage
// Tap → opens app to Overzicht

struct MediumWidgetView: View {
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
            ContainerRelativeShape()
                .fill(bg)

            VStack(alignment: .leading, spacing: 0) {
                // MARK: Top — KPI Row
                HStack(spacing: 0) {
                    // Openstaand
                    VStack(alignment: .leading, spacing: 3) {
                        Text("OPENSTAAND")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(PayWatchColors.muted)
                            .tracking(0.5)

                        Text(formatEurosShort(data.outstandingAmount))
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(colorScheme == .dark ? .white : PayWatchColors.text)
                            .minimumScaleFactor(0.7)
                            .lineLimit(1)
                            .privacySensitive()

                        Text("\(data.upcomingCount) rekeningen")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(PayWatchColors.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Divider
                    Rectangle()
                        .fill(PayWatchColors.border.opacity(0.5))
                        .frame(width: 1, height: 40)

                    // Achterstallig
                    VStack(alignment: .leading, spacing: 3) {
                        Text("ACHTERSTALLIG")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(PayWatchColors.muted)
                            .tracking(0.5)

                        Text("\(data.overdueCount)")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(data.overdueCount == 0 ? PayWatchColors.green : PayWatchColors.red)

                        Text(data.overdueCount == 0 ? "alles op tijd" : "hebben aandacht nodig")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(data.overdueCount == 0 ? PayWatchColors.green : PayWatchColors.red)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 14)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)

                // Separator
                Rectangle()
                    .fill(PayWatchColors.border.opacity(0.3))
                    .frame(height: 1)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                // MARK: Bottom — Next Bill
                if let bill = data.nextBill {
                    HStack(spacing: 10) {
                        // Stage indicator dot (vertical line accent)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(stageColor(bill.stage))
                            .frame(width: 3, height: 36)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Volgende betaling")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(PayWatchColors.muted)

                            HStack(spacing: 6) {
                                Text(bill.vendor)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(colorScheme == .dark ? .white : PayWatchColors.text)
                                    .lineLimit(1)

                                Text("·")
                                    .foregroundColor(PayWatchColors.muted)

                                Text(stageLabel(bill.stage))
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(stageColor(bill.stage))
                            }
                        }

                        Spacer()

                        // Amount + countdown
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(formatEurosShort(bill.amount))
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(PayWatchColors.blue)
                                .privacySensitive()

                            Text(relativeDateDutch(bill.dueDate))
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(bill.daysUntil <= 1 ? PayWatchColors.amber : PayWatchColors.muted)
                        }
                    }
                    .padding(.horizontal, 16)
                } else {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(PayWatchColors.green)
                        Text("Geen komende betalingen")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(PayWatchColors.muted)
                    }
                    .padding(.horizontal, 16)
                }

                Spacer(minLength: 0)

                // MARK: Footer — Stale data indicator
                if !isDataFresh(data.updatedAt) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 8))
                        Text("Open app om te vernieuwen")
                            .font(.system(size: 9, weight: .medium))
                    }
                    .foregroundColor(PayWatchColors.muted.opacity(0.6))
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                }
            }
            .padding(.bottom, 4)
        }
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }
}

// MARK: - Preview

struct MediumWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        MediumWidgetView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .previewDisplayName("Medium — Light")

        MediumWidgetView(data: .placeholder)
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .environment(\.colorScheme, .dark)
            .previewDisplayName("Medium — Dark")
    }
}
