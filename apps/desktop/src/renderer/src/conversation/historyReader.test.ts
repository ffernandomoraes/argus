import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistoryReader } from './historyReader';

describe('createHistoryReader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads again shortly after a new revision, counting from the last one', async () => {
    const read = vi.fn(() => Promise.resolve(1));
    const reader = createHistoryReader(read, () => {});
    reader.sync(0, 0);
    await vi.runOnlyPendingTimersAsync();
    expect(read).toHaveBeenCalledTimes(1);

    reader.sync(1, 0);
    await vi.advanceTimersByTimeAsync(200);
    reader.sync(2, 0);
    await vi.advanceTimersByTimeAsync(200);
    // Immediate reads for revisions 1 and 2; the follow-up waits for the last one.
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('does not schedule a follow-up on the first sync or after dispose', async () => {
    const read = vi.fn(() => Promise.resolve(1));
    const reader = createHistoryReader(read, () => {});
    reader.sync(0, 0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(1);

    reader.sync(1, 0);
    reader.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
