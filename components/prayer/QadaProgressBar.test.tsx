import { render, screen } from '@testing-library/react-native';

import { QadaProgressBar } from './QadaProgressBar';

describe('QadaProgressBar', () => {
  it('shows the remaining count as text', async () => {
    await render(
      <QadaProgressBar label="Fajr" initialCount={300} remainingCount={230} />
    );
    expect(screen.getByText('230 remaining')).toBeTruthy();
  });

  it('shows "All caught up" once remaining count reaches zero', async () => {
    await render(
      <QadaProgressBar label="Fajr" initialCount={300} remainingCount={0} />
    );
    expect(screen.getByText('All caught up')).toBeTruthy();
  });

  it('exposes an accessible progressbar with the right value', async () => {
    await render(
      <QadaProgressBar label="Dhuhr" initialCount={300} remainingCount={230} />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 300, now: 70 });
    expect(bar.props.accessibilityLabel).toBe('Dhuhr qada progress');
  });

  it('treats zero initial debt as fully complete rather than dividing by zero', async () => {
    await render(
      <QadaProgressBar label="Asr" initialCount={0} remainingCount={0} />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 0, now: 0 });
    expect(screen.getByText('All caught up')).toBeTruthy();
  });

  it('renders the given label, including a non-prayer label like "Overall"', async () => {
    await render(
      <QadaProgressBar label="Overall" initialCount={1500} remainingCount={1000} />
    );
    expect(screen.getByText('Overall')).toBeTruthy();
    expect(screen.getByText('1,000 remaining')).toBeTruthy();
  });
});
