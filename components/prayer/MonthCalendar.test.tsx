import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildMonthGrid } from '@/lib/calendar';

import { MonthCalendar } from './MonthCalendar';

describe('MonthCalendar', () => {
  const today = new Date(2026, 7, 18); // August 18, 2026

  it('renders the month label and weekday headers', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    await render(
      <MonthCalendar monthLabel="August 2026" cells={cells} onSelectDay={jest.fn()} />
    );
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('Mo')).toBeTruthy();
    expect(screen.getByText('Su')).toBeTruthy();
  });

  it('calls onSelectDay with the correct ISO date when a past day is tapped', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    const onSelectDay = jest.fn();
    await render(
      <MonthCalendar monthLabel="August 2026" cells={cells} onSelectDay={onSelectDay} />
    );

    await fireEvent.press(screen.getByLabelText('2026-08-05, none'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-08-05');
  });

  it('disables future days so they cannot be tapped', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    const onSelectDay = jest.fn();
    await render(
      <MonthCalendar monthLabel="August 2026" cells={cells} onSelectDay={onSelectDay} />
    );

    const futureDay = screen.getByLabelText('2026-08-25, future');
    expect(futureDay.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(futureDay);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('marks the selected day via accessibilityState', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    await render(
      <MonthCalendar
        monthLabel="August 2026"
        cells={cells}
        selectedIso="2026-08-05"
        onSelectDay={jest.fn()}
      />
    );
    const selectedDay = screen.getByLabelText('2026-08-05, none');
    expect(selectedDay.props.accessibilityState.selected).toBe(true);
  });

  it('calls onPrevMonth/onNextMonth when nav arrows are pressed', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    const onPrevMonth = jest.fn();
    const onNextMonth = jest.fn();
    await render(
      <MonthCalendar
        monthLabel="August 2026"
        cells={cells}
        onSelectDay={jest.fn()}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />
    );

    await fireEvent.press(screen.getByLabelText('Previous month'));
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(onPrevMonth).toHaveBeenCalledTimes(1);
    expect(onNextMonth).toHaveBeenCalledTimes(1);
  });

  it('disables the nav arrow when no handler is given (e.g. cannot navigate past current month)', async () => {
    const cells = buildMonthGrid(2026, 7, {}, today);
    await render(
      <MonthCalendar monthLabel="August 2026" cells={cells} onSelectDay={jest.fn()} />
    );
    expect(screen.getByLabelText('Next month').props.accessibilityState?.disabled).toBe(true);
  });
});
