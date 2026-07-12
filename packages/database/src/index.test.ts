import { describe, expect, it, vi } from 'vitest';
import { createConnectivityManager, type ConnectivityClient } from './index';

describe('database connectivity manager', () => {
  it('checks connectivity without business tables', async () => {
    const client = {
      end: vi.fn(),
      unsafe: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as ConnectivityClient;
    const manager = createConnectivityManager(client);

    await expect(manager.checkConnectivity()).resolves.toBeUndefined();
    expect(client.unsafe).toHaveBeenCalledWith('select 1');
  });

  it('propagates connectivity failures', async () => {
    const client = {
      end: vi.fn(),
      unsafe: vi.fn().mockRejectedValue(new Error('unavailable')),
    } as unknown as ConnectivityClient;

    await expect(
      createConnectivityManager(client).checkConnectivity(),
    ).rejects.toThrow('unavailable');
  });

  it('closes the client cleanly', async () => {
    const client = {
      end: vi.fn(),
      unsafe: vi.fn(),
    } as unknown as ConnectivityClient;
    await createConnectivityManager(client).close();
    expect(client.end).toHaveBeenCalledWith({ timeout: 5 });
  });
});
