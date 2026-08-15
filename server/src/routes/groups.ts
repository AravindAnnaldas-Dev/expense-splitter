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
