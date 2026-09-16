import { describe, expect, it, vi } from "vitest";

import { DisposableStore } from "./index";

describe("DisposableStore", () => {
  it("按注册顺序的逆序释放资源", async () => {
    const calls: number[] = [];
    const store = new DisposableStore();
    store.add({ dispose: vi.fn(() => void calls.push(1)) });
    store.add({ dispose: vi.fn(() => void calls.push(2)) });

    await store.dispose();

    expect(calls).toEqual([2, 1]);
  });

  it("重复释放时保持幂等", async () => {
    const dispose = vi.fn();
    const store = new DisposableStore();
    store.add({ dispose });

    await store.dispose();
    await store.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });
});
