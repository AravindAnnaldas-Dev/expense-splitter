import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const [alice, bob, carol] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@example.com" },
      update: {},
      create: { name: "Alice", email: "alice@example.com", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {},
      create: { name: "Bob", email: "bob@example.com", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "carol@example.com" },
      update: {},
      create: { name: "Carol", email: "carol@example.com", passwordHash },
    }),
  ]);

  const group = await prisma.group.create({
    data: {
      name: "Goa Trip",
      members: {
        create: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }],
      },
    },
    include: { members: true },
  });

  const memberByUserId = new Map(group.members.map((m) => [m.userId, m.id]));
  const aliceMember = memberByUserId.get(alice.id) as string;
  const bobMember = memberByUserId.get(bob.id) as string;
  const carolMember = memberByUserId.get(carol.id) as string;

  // Expense 1: Alice pays ₹3000 for the hotel, split equally 3 ways (1000 each).
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { groupId: group.id, description: "Hotel", amount: 300000, paidById: aliceMember },
    });
    await tx.expenseShare.createMany({
      data: [aliceMember, bobMember, carolMember].map((memberId) => ({
        expenseId: expense.id,
        memberId,
        amount: 100000,
      })),
    });
  });

  // Expense 2: Bob pays ₹900 for dinner, split equally 3 ways (300 each).
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { groupId: group.id, description: "Dinner", amount: 90000, paidById: bobMember },
    });
    await tx.expenseShare.createMany({
      data: [aliceMember, bobMember, carolMember].map((memberId) => ({
        expenseId: expense.id,
        memberId,
        amount: 30000,
      })),
    });
  });

  console.log("Seeded users: alice@example.com / bob@example.com / carol@example.com (password: password123)");
  console.log(`Seeded group "${group.name}" (${group.id}) with 2 expenses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
