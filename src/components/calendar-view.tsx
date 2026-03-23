'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Bill, type EscalationStage, formatCents } from '@/lib/bills';

const STAGE_DOT_COLORS: Record<EscalationStage, string> = {
  factuur: 'bg-pw-blue',
  herinnering: 'bg-pw-amber',
  aanmaning: 'bg-pw-orange',
  incasso: 'bg-pw-red',
  deurwaarder: 'bg-[#991B1B]',
};

const STAGE_TEXT_COLORS: Record<EscalationStage, string> = {
  factuur: 'text-pw-blue',
  herinnering: 'text-pw-amber',
  aanmaning: 'text-pw-orange',
  incasso: 'text-pw-red',
  deurwaarder: 'text-[#991B1B]',
};

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

interface CalendarViewProps {
  bills: Bill[];
  onSelectBill: (bill: Bill) => void;
}

export default function CalendarView({ bills, onSelectBill }: CalendarViewProps) {
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  // Month offset from current month (-6 to +6)
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const viewMonth = new Date(todayYear, todayMonth + monthOffset, 1);
  const currentMonth = viewMonth.getMonth();
  const currentYear = viewMonth.getFullYear();
  const isCurrentMonth = monthOffset === 0;

  // Navigation limits: 6 months back, 6 months forward
  const canGoBack = monthOffset > -6;
  const canGoForward = monthOffset < 6;

  function handlePrevMonth() {
    if (canGoBack) {
      setMonthOffset((prev) => prev - 1);
      setSelectedDay(null);
    }
  }

  function handleNextMonth() {
    if (canGoForward) {
      setMonthOffset((prev) => prev + 1);
      setSelectedDay(null);
    }
  }

  function handleGoToToday() {
    setMonthOffset(0);
    setSelectedDay(null);
  }

  // Build calendar grid
  const { weeks, monthLabel } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

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

  // Map bills to day numbers for current view month
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

  // Bills for the selected day
  const selectedDayBills = selectedDay ? (billsByDay[selectedDay] || []) : [];

  // Upcoming bills (next 14 days from today, not settled) — only on current month
  const upcomingBills = useMemo(() => {
    if (!isCurrentMonth) return [];
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    return bills
      .filter((b) => b.status !== 'settled' && b.due_date >= todayStr && b.due_date <= futureStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
  }, [bills, isCurrentMonth, today]);

  // Count total bills in this month
  const monthBillCount = Object.values(billsByDay).reduce((sum, arr) => sum + arr.length, 0);

  function handleDayTap(day: number) {
    const dayBills = billsByDay[day] || [];
    if (dayBills.length === 1) {
      onSelectBill(dayBills[0]);
      setSelectedDay(null);
    } else if (dayBills.length > 1) {
      setSelectedDay(selectedDay === day ? null : day);
    }
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoBack}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            canGoBack ? 'text-pw-text hover:bg-pw-border/50' : 'text-pw-muted/30'
          }`}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="text-center">
          <button
            onClick={handleGoToToday}
            className="text-[16px] font-bold text-pw-navy hover:text-pw-blue transition-colors"
          >
            {monthLabel}
          </button>
          {monthBillCount > 0 && (
            <p className="text-[10px] text-pw-muted">
              {monthBillCount} {monthBillCount === 1 ? 'rekening' : 'rekeningen'}
            </p>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          disabled={!canGoForward}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            canGoForward ? 'text-pw-text hover:bg-pw-border/50' : 'text-pw-muted/30'
          }`}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* "Vandaag" button when not on current month */}
      {!isCurrentMonth && (
        <button
          onClick={handleGoToToday}
          className="mx-auto flex items-center gap-1 rounded-full bg-pw-blue/10 px-3 py-1 text-[11px] font-semibold text-pw-blue"
        >
          Vandaag
        </button>
      )}

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
              const isToday = isCurrentMonth && day === todayDate;
              const hasBills = dayBills.length > 0;
              const isSelected = selectedDay === day;
              const isPast = isCurrentMonth
                ? day < todayDate
                : monthOffset < 0;

              return (
                <button
                  key={di}
                  onClick={() => hasBills && handleDayTap(day)}
                  disabled={!hasBills}
                  className={`flex h-10 flex-col items-center justify-center rounded-input transition-colors ${
                    isSelected
                      ? 'bg-pw-blue/10 border border-pw-blue'
                      : isToday
                        ? 'border-2 border-pw-blue bg-blue-50/30'
                        : hasBills
                          ? 'hover:bg-pw-bg'
                          : ''
                  } ${isPast && !isToday && !hasBills ? 'opacity-40' : ''}`}
                >
                  <span
                    className={`text-[12px] ${
                      isSelected
                        ? 'font-bold text-pw-blue'
                        : isToday
                          ? 'font-bold text-pw-blue'
                          : isPast
                            ? 'text-pw-muted'
                            : 'text-pw-text'
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

      {/* Selected day bills */}
      {selectedDay && selectedDayBills.length > 0 && (
        <div>
          <h3 className="mb-2 text-[14px] font-bold text-pw-navy">
            {selectedDay}{' '}
            {new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('nl-NL', { month: 'long' })}
            <span className="ml-1.5 text-[12px] font-normal text-pw-muted">
              ({selectedDayBills.length} rekeningen)
            </span>
          </h3>
          <div className="space-y-2">
            {selectedDayBills.map((bill) => (
              <button
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="bill-row-press flex w-full items-center justify-between rounded-card border border-pw-border bg-pw-surface px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-pw-text">{bill.vendor}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`escalation-dot ${STAGE_DOT_COLORS[bill.escalation_stage] || 'bg-pw-blue'}`} />
                    <span className={`text-[11px] font-semibold ${STAGE_TEXT_COLORS[bill.escalation_stage] || 'text-pw-blue'}`}>
                      {bill.escalation_stage}
                    </span>
                  </div>
                </div>
                <p className="ml-3 text-[14px] font-bold text-pw-text">
                  {formatCents(bill.amount, bill.currency)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming section — only on current month, when no day selected */}
      {!selectedDay && isCurrentMonth && upcomingBills.length > 0 && (
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
                  <p className="truncate text-[13px] font-semibold text-pw-text">{bill.vendor}</p>
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
