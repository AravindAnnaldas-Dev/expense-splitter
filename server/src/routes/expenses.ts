import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
}

/**
 * EQUAL-SPLIT ROUNDING
 *
 * amount is an integer number of paise/cents, so amount / N is only exact
 * when N divides amount evenly. E.g. ₹100 (10000 paise) split 3 ways is
 * 3333.33... paise each — shares must be integers, and they must sum back
 * to exactly 10000, or the balance invariant (net balances sum to zero)
 * breaks immediately.
 *
 * We take base = Math.floor(amount / N) for everyone, which leaves a
 * remainder of `amount - base * N` cents (always < N, since N is the
 * divisor). We give that entire remainder to the payer's share.
 *
 * Why the payer and not "the first member in the list": the member order
 * in a split is just whatever order the client sent them in, which is
 * arbitrary and not something a user would notice or care about. The payer
 * is already a fixed, meaningful identity in the expense, so putting the
 * rounding remainder on their share is deterministic and easy to explain
 * ("if it doesn't divide evenly, the odd cent stays with whoever paid").
 */
function computeEqualShares(amount: number, memberIds: string[], paidById: string) {
  const n = memberIds.length;
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;

  return memberIds.map((memberId) => ({
    memberId,
    amount: memberId === paidById ? base + remainder : base,
  }));
}

const createExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().min(1).max(200),
  amount: z.number().int().positive("Amount must be a positive integer (smallest currency unit)"),
  paidById: z.string().min(1), // GroupMember id
  memberIds: z.array(z.string().min(1)).min(1, "At least one member must be included in the split"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { groupId, description, amount, paidById, memberIds } = parsed.data;

  const requesterMembership = await getMembership(groupId, req.userId as string);
  if (!requesterMembership) return res.status(403).json({ error: "You are not a member of this group" });

  // Validate that every member in the split (and the payer) actually
  // belongs to this group. Without this check, a client could create a
  // share for a memberId from a totally different group, silently
  // corrupting that other group's balances.
  const uniqueIds = Array.from(new Set([...memberIds, paidById]));
  const validMembers = await prisma.groupMember.findMany({
    where: { id: { in: uniqueIds }, groupId },
    select: { id: true },
  });
  if (validMembers.length !== uniqueIds.length) {
    return res.status(400).json({ error: "One or more members do not belong to this group" });
  }

  const shares = computeEqualShares(amount, memberIds, paidById);

  // TRANSACTION: the expense row and its N share rows must be created
  // atomically. If we created the expense, then crashed or errored before
  // writing all the shares, the balance calculation (which sums shares)
  // would see a payer who "paid" the full amount but shares that don't add
  // up to it — silently wrong balances that look like valid data rather
  // than an obvious error. Wrapping both writes in prisma.$transaction
  // guarantees it's all-or-nothing: either the expense and all its shares
  // exist, or none of it does.
  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: { groupId, description, amount, paidById },
    });
    await tx.expenseShare.createMany({
      data: shares.map((s) => ({ expenseId: created.id, memberId: s.memberId, amount: s.amount })),
    });
    return tx.expense.findUniqueOrThrow({
      where: { id: created.id },
      include: { shares: true, paidBy: { include: { user: { select: { id: true, name: true } } } } },
    });
  });

  res.status(201).json({ expense });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const expense = await prisma.expense.findUnique({
    where: { id: req.params.id },
    include: { shares: { include: { member: { include: { user: true } } } }, paidBy: { include: { user: true } } },
  });
  if (!expense) return res.status(404).json({ error: "Expense not found" });

  const membership = await getMembership(expense.groupId, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  res.json({ expense });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return res.status(404).json({ error: "Expense not found" });

  const membership = await getMembership(expense.groupId, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  // ExpenseShare rows cascade-delete via the schema's onDelete: Cascade, so
  // the balance calculation reflects the deletion immediately since it's
  // always computed fresh, not cached.
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
