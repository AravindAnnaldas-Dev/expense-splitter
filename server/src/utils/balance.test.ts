import { describe, it, expect } from "vitest";
import { simplifySettlements, MemberBalance } from "./balance";

function balance(memberId: string, net: number): MemberBalance {
  return { memberId, userId: memberId, name: memberId, net };
}

function totalTransferred(suggestions: ReturnType<typeof simplifySettlements>) {
  return suggestions.reduce((sum, s) => sum + s.amount, 0);
}

describe("simplifySettlements", () => {
  it("returns nothing when everyone is already at zero", () => {
    const balances = [balance("a", 0), balance("b", 0)];
    expect(simplifySettlements(balances)).toEqual([]);
  });

  it("settles a simple two-person debt directly", () => {
    const balances = [balance("a", 100), balance("b", -100)];
    const result = simplifySettlements(balances);
    expect(result).toEqual([{ from: expect.objectContaining({ memberId: "b" }), to: expect.objectContaining({ memberId: "a" }), amount: 100 }]);
  });

  it("uses at most N-1 transactions for N people with nonzero balances", () => {
    // 5 people, balances sum to zero, all nonzero.
    const balances = [
      balance("a", 400),
      balance("b", -100),
      balance("c", -150),
      balance("d", 200),
      balance("e", -350),
    ];
    const result = simplifySettlements(balances);
    expect(result.length).toBeLessThanOrEqual(balances.length - 1);
  });

  it("moves exactly the total amount owed, no more and no less", () => {
    const balances = [balance("a", 300), balance("b", 150), balance("c", -450)];
    const result = simplifySettlements(balances);
    expect(totalTransferred(result)).toBe(450);
  });

  it("leaves every settled member at exactly zero after applying the suggestions", () => {
    const balances = [
      balance("a", 170000),
      balance("b", -40000),
      balance("c", -130000),
    ];
    const result = simplifySettlements(balances);

    const net = new Map(balances.map((b) => [b.memberId, b.net]));
    for (const s of result) {
      net.set(s.from.memberId, (net.get(s.from.memberId) ?? 0) + s.amount);
      net.set(s.to.memberId, (net.get(s.to.memberId) ?? 0) - s.amount);
    }
    for (const value of net.values()) {
      expect(value).toBe(0);
    }
  });

  it("handles a debtor and creditor with exactly matching amounts, dropping both together", () => {
    const balances = [balance("a", 500), balance("b", -500), balance("c", 0)];
    const result = simplifySettlements(balances);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(500);
  });

  it("ignores members already at zero", () => {
    const balances = [balance("a", 100), balance("b", -100), balance("c", 0), balance("d", 0)];
    const result = simplifySettlements(balances);
    expect(result.every((s) => s.from.memberId !== "c" && s.from.memberId !== "d")).toBe(true);
    expect(result.every((s) => s.to.memberId !== "c" && s.to.memberId !== "d")).toBe(true);
  });
});
