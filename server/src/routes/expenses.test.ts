import { describe, it, expect } from "vitest";
import { computeEqualShares } from "./expenses";

describe("computeEqualShares", () => {
  it("splits an amount evenly when it divides cleanly", () => {
    const shares = computeEqualShares(300, ["a", "b", "c"], "a");
    expect(shares).toEqual([
      { memberId: "a", amount: 100 },
      { memberId: "b", amount: 100 },
      { memberId: "c", amount: 100 },
    ]);
  });

  it("gives the rounding remainder entirely to the payer", () => {
    // 100 paise / 3 = 33.33..., base = 33, remainder = 1
    const shares = computeEqualShares(100, ["a", "b", "c"], "b");
    const byMember = Object.fromEntries(shares.map((s) => [s.memberId, s.amount]));
    expect(byMember.a).toBe(33);
    expect(byMember.c).toBe(33);
    expect(byMember.b).toBe(34); // 33 + remainder of 1
  });

  it("always produces shares that sum back to exactly the original amount", () => {
    // Try a range of amounts and group sizes to make sure rounding never
    // drifts — this is the property the balance-sum-to-zero invariant
    // depends on.
    for (const amount of [1, 7, 99, 100, 1000, 123457]) {
      for (const n of [1, 2, 3, 4, 5, 7]) {
        const memberIds = Array.from({ length: n }, (_, i) => `m${i}`);
        const shares = computeEqualShares(amount, memberIds, memberIds[0]);
        const total = shares.reduce((sum, s) => sum + s.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("handles a single-member split (payer covers the whole amount)", () => {
    const shares = computeEqualShares(500, ["a"], "a");
    expect(shares).toEqual([{ memberId: "a", amount: 500 }]);
  });

  it("gives the payer the remainder even when the payer isn't first in the list", () => {
    const shares = computeEqualShares(10, ["a", "b", "c"], "c");
    const byMember = Object.fromEntries(shares.map((s) => [s.memberId, s.amount]));
    // 10 / 3 = base 3, remainder 1 -> payer (c) gets 3 + 1 = 4
    expect(byMember.c).toBe(4);
    expect(byMember.a).toBe(3);
    expect(byMember.b).toBe(3);
  });
});
