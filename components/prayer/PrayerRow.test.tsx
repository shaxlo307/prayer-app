import { fireEvent, render, screen } from '@testing-library/react-native';

import { PrayerRow } from './PrayerRow';

// RNTL v14 (React 19) made render/fireEvent/act async by default — every
// call must be awaited so pending updates flush before assertions run.

describe('PrayerRow', () => {
  it('renders the prayer name and time', async () => {
    await render(<PrayerRow prayer="fajr" time="5:12 AM" status="unmarked" />);
    expect(screen.getByText('Fajr')).toBeTruthy();
    expect(screen.getByText('5:12 AM')).toBeTruthy();
  });

  it('only shows a badge when explicitly given one', async () => {
    const { rerender } = await render(
      <PrayerRow prayer="dhuhr" time="12:34 PM" status="unmarked" />
    );
    expect(screen.queryByText('Now')).toBeNull();

    await rerender(<PrayerRow prayer="dhuhr" time="12:34 PM" status="unmarked" badge="Now" />);
    expect(screen.getByText('Now')).toBeTruthy();
  });

  it('calls onPress when the row is tapped (toggles unmarked <-> done)', async () => {
    const onPress = jest.fn();
    await render(<PrayerRow prayer="asr" time="4:02 PM" status="unmarked" onPress={onPress} />);
    await fireEvent.press(screen.getAllByRole('button')[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onLongPress to mark late, as a distinct gesture from onPress', async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    await render(
      <PrayerRow
        prayer="maghrib"
        time="7:15 PM"
        status="unmarked"
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
    await fireEvent(screen.getAllByRole('button')[0], 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reflects status in the accessibility label for done/late/unmarked', async () => {
    const { rerender } = await render(
      <PrayerRow prayer="isha" time="8:45 PM" status="unmarked" />
    );
    expect(screen.getAllByRole('button')[0].props.accessibilityLabel).toContain('unmarked');

    await rerender(<PrayerRow prayer="isha" time="8:45 PM" status="done" />);
    expect(screen.getAllByRole('button')[0].props.accessibilityLabel).toContain('done');

    await rerender(<PrayerRow prayer="isha" time="8:45 PM" status="late" />);
    expect(screen.getAllByRole('button')[0].props.accessibilityLabel).toContain('late');
  });

  it('disables the notification toggle button when no handler is given', async () => {
    await render(<PrayerRow prayer="fajr" time="5:12 AM" status="unmarked" />);
    const bellButtons = screen.getAllByRole('button');
    // Row itself + the bell icon button — the bell one should be disabled
    // when no onToggleNotification handler was passed.
    const bell = bellButtons.find((b) => b.props.accessibilityLabel?.includes('Notifications'));
    expect(bell?.props.accessibilityState?.disabled).toBe(true);
  });

  it('calls onToggleNotification when the bell is pressed, without triggering onPress', async () => {
    const onPress = jest.fn();
    const onToggleNotification = jest.fn();
    await render(
      <PrayerRow
        prayer="fajr"
        time="5:12 AM"
        status="unmarked"
        onPress={onPress}
        onToggleNotification={onToggleNotification}
      />
    );
    const bell = screen.getByLabelText('Notifications on for Fajr');
    await fireEvent.press(bell);
    expect(onToggleNotification).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
