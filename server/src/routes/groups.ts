import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeGroupBalances, simplifySettlements } from "../utils/balance";

const router = Router();
router.use(requireAuth);

// Helper: throws a 403-worthy result by returning null if the requesting
// user isn't a member of the group. Every group-scoped route needs this
// check so users can't read or mutate groups they don't belong to.
async function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId: req.userId as string } },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  res.status(201).json({ group });
});

router.get("/", async (req: AuthedRequest, res) => {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ groups });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      expenses: { include: { shares: true, paidBy: { include: { user: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!group) return res.status(404).json({ error: "Group not found" });

  res.json({ group });
});

const addMemberSchema = z.object({
  email: z.string().email(),
});

router.post("/:id/members", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: "No user found with that email" });

  const existing = await getMembership(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: "User is already a member of this group" });

  const member = await prisma.groupMember.create({
    data: { groupId: req.params.id, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.status(201).json({ member });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  await prisma.group.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.delete("/:id/members/:memberId", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  const target = await prisma.groupMember.findUnique({ where: { id: req.params.memberId } });
  if (!target || target.groupId !== req.params.id) {
    return res.status(404).json({ error: "Member not found in this group" });
  }

  // A member with existing expense shares can't be cleanly removed — doing
  // so would either cascade-delete their shares (silently changing past
  // balances) or leave dangling references. Simplest safe rule: only allow
  // removing members who paid nothing and owe nothing yet.
  const hasActivity = await prisma.expenseShare.findFirst({ where: { memberId: target.id } });
  const hasPaid = await prisma.expense.findFirst({ where: { paidById: target.id } });
  if (hasActivity || hasPaid) {
    return res.status(409).json({ error: "Can't remove a member who is part of existing expenses" });
  }

  await prisma.groupMember.delete({ where: { id: target.id } });
  res.status(204).send();
});

const createSettlementSchema = z.object({
  fromId: z.string().min(1), // GroupMember who paid
  toId: z.string().min(1), // GroupMember who received
  amount: z.number().int().positive("Amount must be a positive integer (smallest currency unit)"),
});

// POST /:id/settlements — records a real-world payment (e.g. "Bob paid
// Alice back in cash"). This is distinct from the settlement *suggestions*
// GET /:id/balances returns — those are computed on the fly and never
// stored. This is the write side that actually changes future balance
// calculations, by adding a row that computeGroupBalances nets against the
// expense/share totals.
router.post("/:id/settlements", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  const parsed = createSettlementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { fromId, toId, amount } = parsed.data;

  if (fromId === toId) {
    return res.status(400).json({ error: "A settlement must be between two different members" });
  }

  const members = await prisma.groupMember.findMany({
    where: { id: { in: [fromId, toId] }, groupId: req.params.id },
    select: { id: true },
  });
  if (members.length !== 2) {
    return res.status(400).json({ error: "Both members must belong to this group" });
  }

  const settlement = await prisma.settlement.create({
    data: { groupId: req.params.id, fromId, toId, amount },
  });

  res.status(201).json({ settlement });
});

// GET /:id/balances — the core reporting endpoint. Always derived live from
// expenses + shares + settlements (see utils/balance.ts), never cached.
router.get("/:id/balances", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.params.id, req.userId as string);
  if (!membership) return res.status(403).json({ error: "You are not a member of this group" });

  const balances = await computeGroupBalances(req.params.id);
  const settlements = simplifySettlements(balances);

  res.json({ balances, settlements });
});

export default router;
