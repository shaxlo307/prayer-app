import { render, screen } from '@testing-library/react-native';

import { ProgressRing } from './ProgressRing';

// RNTL v14 (React 19) made render/act async by default — every render call
// must be awaited so pending updates flush before assertions run.

describe('ProgressRing', () => {
  it('shows the completed/total fraction as text', async () => {
    await render(<ProgressRing completed={3} total={5} />);
    // Nested <Text> flattens to one host text node in RN, so "3" and "/5"
    // are not separately queryable — they render as a single "3/5" string.
    expect(screen.getByText('3/5')).toBeTruthy();
    expect(screen.getByText('3 of 5 tracked')).toBeTruthy();
  });

  it('exposes an accessible progressbar with the right value', async () => {
    await render(<ProgressRing completed={2} total={5} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 2 });
    expect(bar.props.accessibilityLabel).toBe('2 of 5 prayers tracked today');
  });

  it('shows a starting prompt when nothing is completed', async () => {
    await render(<ProgressRing completed={0} total={5} />);
    expect(screen.getByText("Let's mark your first prayer today.")).toBeTruthy();
  });

  it('shows a completion message when everything is done', async () => {
    await render(<ProgressRing completed={5} total={5} />);
    expect(screen.getByText('All prayers tracked today — well done.')).toBeTruthy();
  });

  it('shows a remaining count for partial progress', async () => {
    await render(<ProgressRing completed={3} total={5} />);
    expect(screen.getByText('2 more to go today.')).toBeTruthy();
  });

  it('lets the caller override the subtext', async () => {
    await render(<ProgressRing completed={1} total={5} subtext="Custom message" />);
    expect(screen.getByText('Custom message')).toBeTruthy();
  });

  it('clamps the visual fraction when completed exceeds total', async () => {
    // Shouldn't crash or render a >100% ring; the accessibility value still
    // reports the raw numbers so screen readers hear the true count.
    await render(<ProgressRing completed={7} total={5} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue.now).toBe(7);
  });
});
