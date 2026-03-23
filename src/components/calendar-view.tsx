'use client';

import { useMemo } from 'react';
import { type Bill, type EscalationStage, formatCents } from '@/lib/bills';

const STAGE_DOT_COLORS: Record<EscalationStage, string> = {
  factuur: 'bg-pw-blue',
  herinnering: 'bg-pw-amber',
  aanmaning: 'bg-pw-orange',
  incasso: 'bg-pw-red',
  deurwaarder: 'bg-[#991B1B]',
};

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

interface CalendarViewProps {
  bills: Bill[];
  onSelectBill: (bill: Bill) => void;
}

export default function CalendarView({ bills, onSelectBill }: CalendarViewProps) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const todayStr = today.toISOString().split('T')[0];

  // Build calendar grid
  const { weeks, monthLabel } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0, Sunday = 6 (ISO week)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const wks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      wks.push(cells.slice(i, i + 7));
    }

    const label = firstDay.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    return { weeks: wks, monthLabel: label.charAt(0).toUpperCase() + label.slice(1) };
  }, [currentMonth, currentYear]);

  // Map bills to day numbers
  const billsByDay = useMemo(() => {
    const map: Record<number, Bill[]> = {};
    bills.forEach((bill) => {
      const d = new Date(bill.due_date + 'T00:00:00');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(bill);
      }
    });
    return map;
  }, [bills, currentMonth, currentYear]);

  // Upcoming bills (next 14 days, not settled)
  const upcomingBills = useMemo(() => {
    const futureStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    return bills
      .filter((b) => b.status !== 'settled' && b.due_date >= todayStr && b.due_date <= futureStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
  }, [bills, todayStr]);

  const todayDate = today.getDate();

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="text-center">
        <h2 className="text-[16px] font-bold text-pw-navy">{monthLabel}</h2>
      </div>

      {/* Calendar grid */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-3">
        {/* Day labels */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-pw-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day === null) return <div key={di} className="h-10" />;

              const dayBills = billsByDay[day] || [];
              const isToday = day === todayDate;
              const hasBills = dayBills.length > 0;

              return (
                <button
                  key={di}
                  onClick={() => {
                    if (dayBills.length === 1) onSelectBill(dayBills[0]);
                  }}
                  disabled={!hasBills}
                  className={`flex h-10 flex-col items-center justify-center rounded-input transition-colors ${
                    isToday
                      ? 'border-2 border-pw-blue bg-blue-50/30'
                      : hasBills
                        ? 'hover:bg-pw-bg'
                        : ''
                  }`}
                >
                  <span
                    className={`text-[12px] ${
                      isToday ? 'font-bold text-pw-blue' : 'text-pw-text'
                    }`}
                  >
                    {day}
                  </span>
                  {hasBills && (
                    <div className="mt-0.5 flex gap-0.5">
                      {dayBills.slice(0, 3).map((bill, bi) => (
                        <div
                          key={bi}
                          className={`h-1.5 w-1.5 rounded-full ${
                            STAGE_DOT_COLORS[bill.escalation_stage] || 'bg-pw-blue'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Upcoming section */}
      {upcomingBills.length > 0 && (
        <div>
          <h3 className="mb-2 text-[14px] font-bold text-pw-navy">Binnenkort</h3>
          <div className="space-y-2">
            {upcomingBills.map((bill) => (
              <button
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="bill-row-press flex w-full items-center justify-between rounded-card border border-pw-border bg-pw-surface px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-pw-text">
                    {bill.vendor}
                  </p>
                  <p className="text-[11px] text-pw-muted">
                    {new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <p className="ml-3 text-[14px] font-bold text-pw-text">
                  {formatCents(bill.amount, bill.currency)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
