import { prisma } from "../lib/prisma";

export interface MemberBalance {
  memberId: string;
  userId: string;
  name: string;
  /** Positive = this member is owed money. Negative = this member owes money. */
  net: number;
}

export interface SettlementSuggestion {
  from: { memberId: string; userId: string; name: string };
  to: { memberId: string; userId: string; name: string };
  amount: number;
}

/**
 * BALANCE CALCULATION
 *
 * For every member of the group:
 *   net = (sum of amounts they paid across all expenses)
 *       - (sum of their ExpenseShare amounts across all expenses)
 *       + (settlements they received) - wait, see below for the actual sign
 *
 * Concretely, for each expense a member is involved in:
 *  - If they PAID it, the full `amount` counts toward "money they put in."
 *  - Regardless of who paid, if they have an ExpenseShare on that expense,
 *    that share counts toward "money they owe."
 * A member who paid also has their own share (they consumed part of what
 * they bought), so their net contribution from that expense is
 * `amount - theirOwnShare`, which is exactly what paid-minus-owed gives you
 * when summed across all expenses. We don't special-case "the payer" — the
 * paid total and the owed total are just two independent sums over the same
 * rows, and subtracting them naturally accounts for the payer also
 * consuming a share.
 *
 * We also net out recorded Settlements (real-world payments users logged to
 * settle up): if member A already paid member B back some amount, that
 * transfer moves A's net up and B's net down by that amount, same as it
 * would in real life.
 *
 * IMPORTANT: this is computed fresh from the expenses/shares/settlements
 * tables on every call — there is no running balance column anywhere. That
 * guarantees the numbers are always correct even after an expense is edited
 * or deleted; there is nothing cached that could drift out of sync.
 *
 * INVARIANT: sum of all members' net balances in a group must always equal
 * zero, because every dollar counted as "paid" by one member is counted as
 * "owed" by exactly the members in that expense's shares (which always sum
 * to the expense's total amount), and every settlement transfer is a
 * zero-sum move between two members. We assert this before returning, since
 * a nonzero sum would mean a bug in how shares were created.
 */
export async function computeGroupBalances(groupId: string): Promise<MemberBalance[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } },
  });

  const netByMemberId = new Map<string, number>();
  for (const m of members) netByMemberId.set(m.id, 0);

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  for (const expense of expenses) {
    netByMemberId.set(expense.paidById, (netByMemberId.get(expense.paidById) ?? 0) + expense.amount);
    for (const share of expense.shares) {
      netByMemberId.set(share.memberId, (netByMemberId.get(share.memberId) ?? 0) - share.amount);
    }
  }

  const settlements = await prisma.settlement.findMany({ where: { groupId } });
  for (const s of settlements) {
    netByMemberId.set(s.fromId, (netByMemberId.get(s.fromId) ?? 0) + s.amount);
    netByMemberId.set(s.toId, (netByMemberId.get(s.toId) ?? 0) - s.amount);
  }

  const balances: MemberBalance[] = members.map((m) => ({
    memberId: m.id,
    userId: m.user.id,
    name: m.user.name,
    net: netByMemberId.get(m.id) ?? 0,
  }));

  const total = balances.reduce((sum, b) => sum + b.net, 0);
  if (total !== 0) {
    // This should be mathematically impossible given how shares are created
    // (see expenses.ts) — if it ever fires, it points to a data integrity
    // bug (e.g. a share created outside a transaction, or rounding that
    // didn't sum back to the total).
    throw new Error(
      `Balance integrity check failed for group ${groupId}: balances sum to ${total}, expected 0`
    );
  }

  return balances;
}

/**
 * SETTLEMENT SIMPLIFICATION — greedy debt-minimization algorithm
 *
 * Goal: turn a list of net balances into the smallest possible list of
 * "who pays whom" transactions that zeroes everyone out.
 *
 * Step by step:
 *  1. Split members into two piles: debtors (net < 0, they owe money) and
 *     creditors (net > 0, they're owed money). Ignore anyone already at 0.
 *  2. Sort debtors by how much they owe (most negative first) and creditors
 *     by how much they're owed (most positive first).
 *  3. Repeatedly take the biggest debtor and the biggest creditor. Settle
 *     `min(|debtor's debt|, creditor's credit)` between them — i.e. the
 *     smaller of the two amounts, since that's the most either side can
 *     give/receive right now.
 *  4. Subtract that settled amount from both sides. Whichever one hits
 *     exactly zero drops out of its pile; the other stays in with its
 *     remaining balance and is compared against the next person in the
 *     opposite pile.
 *  5. Repeat until both piles are empty.
 *
 * Why this minimizes transactions: at every step at least one person is
 * fully paid off (their balance reaches exactly zero), so each transaction
 * eliminates at least one person from future consideration. With N people
 * who have nonzero balances, you can never need more than N-1 transactions
 * (the last person left must net to zero automatically, by the invariant
 * above), and greedily paying the extremes first is what achieves that
 * bound in practice.
 */
export function simplifySettlements(balances: MemberBalance[]): SettlementSuggestion[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ ...b, net: -b.net })) // work with positive "amount owed"
    .sort((a, b) => b.net - a.net);

  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);

  const suggestions: SettlementSuggestion[] = [];
  let i = 0; // pointer into debtors
  let j = 0; // pointer into creditors

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.net, creditor.net);

    if (amount > 0) {
      suggestions.push({
        from: { memberId: debtor.memberId, userId: debtor.userId, name: debtor.name },
        to: { memberId: creditor.memberId, userId: creditor.userId, name: creditor.name },
        amount,
      });
    }

    debtor.net -= amount;
    creditor.net -= amount;

    if (debtor.net === 0) i++;
    if (creditor.net === 0) j++;
  }

  return suggestions;
}
