//
//  LargeWidgetView.swift
//  PayWatchWidget
//
//  Created by Samba on 27/04/2026.
//

import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Large Widget (4×4) — Bills Mode or Budget Mode

struct LargeWidgetView: View {
    let data: WidgetData
    let mode: WidgetMode
    @Environment(\.colorScheme) var colorScheme

    private var bg: Color { colorScheme == .dark ? PayWatchColors.bgDark : .white }
    private var txt: Color { colorScheme == .dark ? .white : PayWatchColors.text }
    private var sub: Color { colorScheme == .dark ? Color(white: 0.55) : PayWatchColors.muted }
    private var divider: Color { colorScheme == .dark ? Color(white: 0.2) : PayWatchColors.border }

    var body: some View {
        ZStack {
            ContainerRelativeShape().fill(bg)

            if mode == .budget {
                budgetView
            } else {
                billsView
            }
        }
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }

    // MARK: - Bills View

    private var billsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("OPENSTAAND")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text(formatEurosShort(data.outstandingAmount))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(txt)
                        .privacySensitive()
                }
                Spacer()
                // Overdue badge
                if data.overdueCount > 0 {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(data.overdueCount)")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(PayWatchColors.red)
                        Text("achterstallig")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(PayWatchColors.red)
                    }
                } else {
                    VStack(alignment: .trailing, spacing: 2) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(PayWatchColors.green)
                        Text("alles op tijd")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(PayWatchColors.green)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)

            // Divider
            Rectangle().fill(divider.opacity(0.5)).frame(height: 1)
                .padding(.horizontal, 16).padding(.vertical, 8)

            // Bill list header
            Text("KOMENDE BETALINGEN")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(sub)
                .tracking(0.5)
                .padding(.horizontal, 16)
                .padding(.bottom, 6)

            // Bill rows (up to 4 with interactive Betaald button)
            VStack(spacing: 4) {
                ForEach(Array(data.upcomingBills.prefix(4).enumerated()), id: \.offset) { _, bill in
                    BillRow(bill: bill, textColor: txt, subColor: sub)
                }
            }
            .padding(.horizontal, 16)

            Spacer(minLength: 4)

            // Debt countdown footer
            if let months = data.debtFreeMonths, months > 0 {
                HStack(spacing: 6) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 10))
                        .foregroundColor(PayWatchColors.green)
                    Text("Schuldenvrij over ~\(months) maanden")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(PayWatchColors.green)
                    Spacer()
                    // Progress dots
                    HStack(spacing: 3) {
                        ForEach(0..<min(months, 12), id: \.self) { i in
                            Circle()
                                .fill(i < max(1, 12 - months) ? PayWatchColors.green : PayWatchColors.green.opacity(0.25))
                                .frame(width: 4, height: 4)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            } else {
                // Stale data indicator
                if !isDataFresh(data.updatedAt) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 8))
                        Text("Open app om te vernieuwen")
                            .font(.system(size: 9, weight: .medium))
                    }
                    .foregroundColor(sub.opacity(0.6))
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
                }
            }
        }
    }

    // MARK: - Budget View

    private var budgetView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Text("FINANCIEEL OVERZICHT")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(sub)
                .tracking(0.5)
                .padding(.horizontal, 16)
                .padding(.top, 14)

            // Financial metrics
            VStack(spacing: 6) {
                FinancialRow(label: "Inkomen", amount: data.bankIncome, color: PayWatchColors.green, textColor: txt, subColor: sub)
                FinancialRow(label: "Uitgaven", amount: data.bankExpenses, color: PayWatchColors.red, textColor: txt, subColor: sub)
                Rectangle().fill(divider.opacity(0.3)).frame(height: 1).padding(.horizontal, 4)
                FinancialRow(label: "Netto", amount: data.net, color: data.net >= 0 ? PayWatchColors.green : PayWatchColors.red, textColor: txt, subColor: sub, bold: true)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)

            Rectangle().fill(divider.opacity(0.3)).frame(height: 1)
                .padding(.horizontal, 16).padding(.vertical, 8)

            // Vrij besteedbaar highlight
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("VRIJ BESTEEDBAAR")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text(formatEurosShort(data.disposable))
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(data.disposable > 0 ? PayWatchColors.green : PayWatchColors.red)
                        .privacySensitive()
                }
                Spacer()
                // Subscriptions total
                VStack(alignment: .trailing, spacing: 2) {
                    Text("ABONNEMENTEN")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text("\(formatEurosShort(data.subscriptionTotalMonthly))/mnd")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(txt)
                        .privacySensitive()
                }
            }
            .padding(.horizontal, 16)

            Rectangle().fill(divider.opacity(0.3)).frame(height: 1)
                .padding(.horizontal, 16).padding(.vertical, 8)

            // Quick bill summary
            HStack(spacing: 16) {
                StatPill(label: "Openstaand", value: "\(data.upcomingCount)", color: PayWatchColors.blue)
                StatPill(label: "Achterstallig", value: "\(data.overdueCount)", color: data.overdueCount > 0 ? PayWatchColors.red : PayWatchColors.green)
                StatPill(label: "Betaald", value: formatEurosShort(data.paidAmount), color: PayWatchColors.green)
            }
            .padding(.horizontal, 16)

            Spacer(minLength: 4)

            // Debt countdown
            if let months = data.debtFreeMonths, months > 0 {
                HStack(spacing: 6) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 10))
                        .foregroundColor(PayWatchColors.green)
                    Text("Schuldenvrij over ~\(months) maanden")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(PayWatchColors.green)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
        }
    }
}

// MARK: - Bill Row with Interactive Betaald Button

struct BillRow: View {
    let bill: WidgetData.BillSummary
    let textColor: Color
    let subColor: Color

    var body: some View {
        HStack(spacing: 8) {
            // Stage indicator
            RoundedRectangle(cornerRadius: 1.5)
                .fill(stageColor(bill.stage))
                .frame(width: 3, height: 28)

            // Vendor + stage
            VStack(alignment: .leading, spacing: 1) {
                Text(bill.vendor)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(textColor)
                    .lineLimit(1)
                Text(stageLabel(bill.stage))
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(stageColor(bill.stage))
            }

            Spacer()

            // Amount
            Text(formatEurosShort(bill.amount))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(textColor)
                .privacySensitive()

            // Interactive Betaald button (iOS 17+)
            Button(intent: MarkBillAsPaidIntent(vendor: bill.vendor, amountCents: bill.amount)) {
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(PayWatchColors.green.opacity(0.7))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Financial Row

struct FinancialRow: View {
    let label: String
    let amount: Int
    let color: Color
    let textColor: Color
    let subColor: Color
    var bold: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: bold ? .bold : .medium))
                .foregroundColor(subColor)
            Spacer()
            Text(formatEurosShort(amount))
                .font(.system(size: 14, weight: bold ? .bold : .semibold, design: .rounded))
                .foregroundColor(color)
                .privacySensitive()
        }
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(color)
                .privacySensitive()
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundColor(color.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Budget Medium Widget (alternate mode for medium size)

struct BudgetMediumWidgetView: View {
    let data: WidgetData
    @Environment(\.colorScheme) var colorScheme

    private var txt: Color { colorScheme == .dark ? .white : PayWatchColors.text }
    private var sub: Color { colorScheme == .dark ? Color(white: 0.55) : PayWatchColors.muted }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top row: income vs expenses
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("INKOMEN")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text(formatEurosShort(data.bankIncome))
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(PayWatchColors.green)
                        .privacySensitive()
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 3) {
                    Text("UITGAVEN")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text(formatEurosShort(data.bankExpenses))
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(PayWatchColors.red)
                        .privacySensitive()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)

            // Divider
            Rectangle().fill(PayWatchColors.border.opacity(0.3)).frame(height: 1)
                .padding(.horizontal, 16).padding(.vertical, 8)

            // Bottom: vrij besteedbaar + debt countdown
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("VRIJ BESTEEDBAAR")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(sub)
                        .tracking(0.5)
                    Text(formatEurosShort(data.disposable))
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundColor(data.disposable > 0 ? PayWatchColors.green : PayWatchColors.red)
                        .privacySensitive()
                }
                Spacer()
                if let months = data.debtFreeMonths, months > 0 {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("~\(months)m")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundColor(PayWatchColors.green)
                        Text("schuldenvrij")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(PayWatchColors.green)
                    }
                }
            }
            .padding(.horizontal, 16)

            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "nl.paywatch.app://overzicht"))
    }
}
