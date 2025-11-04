/*
 * If you need to initialize your database with some data, you may write a script
 * to do so here.
 */
"use strict";
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // --- Users ---
  const usersData = [
    {
      utorid: "asadmir",
      name: "Asad Mirza",
      email: "asad.mirza@utoronto.ca",
      verified: true,
      role: "manager",
      password: null,
    },
    {
      utorid: "johndoe",
      name: "John Doe",
      email: "john.doe@utoronto.ca",
      verified: false,
      role: "regular",
      password: null,
    },
    {
      utorid: "janedoe",
      name: "Jane Doe",
      email: "jane.doe@utoronto.ca",
      verified: true,
      role: "regular",
      password: null,
    },
    {
      utorid: "alicew",
      name: "Alice Wong",
      email: "alice.wong@utoronto.ca",
      verified: true,
      role: "manager",
      password: null,
    },
    {
      utorid: "bobsmith",
      name: "Bob Smith",
      email: "bob.smith@utoronto.ca",
      verified: false,
      role: "regular",
      password: null,
    },
  ];

  const users = [];
  for (const u of usersData) {
    const user = await prisma.user.create({ data: u });
    users.push(user);
  }

  // --- Reset Tokens ---
  const resetTokensData = users.map((user) => ({
    token: uuidv4(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
    userId: user.id,
  }));

  for (const rt of resetTokensData) {
    await prisma.resetToken.create({ data: rt });
  }

  // --- PROMOTIONS ---
  const promotionsData = [
    {
      name: "Start of Summer Celebration",
      description: "Celebrate the start of summer with bonus points!",
      type: "automatic",
      startTime: new Date("2025-06-01T09:00:00Z"),
      endTime: new Date("2025-06-07T23:59:59Z"),
      minSpending: 50,
      rate: 0.01, // 1 extra point per $1 spent
      points: 0,
    },
    {
      name: "Buy a Pack of Pepsi",
      description: "Get bonus points for purchasing a pack of Pepsi.",
      type: "onetime",
      startTime: new Date("2025-07-10T00:00:00Z"),
      endTime: new Date("2025-07-20T23:59:59Z"),
      minSpending: null,
      rate: null,
      points: 20,
    },
    {
      name: "Back to School Bonus",
      description: "Earn extra points as you prepare for the new school year!",
      type: "automatic",
      startTime: new Date("2025-09-01T00:00:00Z"),
      endTime: new Date("2025-09-10T23:59:59Z"),
      minSpending: 30,
      rate: 0.05, // 5% bonus points
      points: 0,
    },
    {
      name: "One-Time Signup Gift",
      description: "Welcome gift for new users signing up!",
      type: "onetime",
      startTime: new Date("2025-01-01T00:00:00Z"),
      endTime: new Date("2025-12-31T23:59:59Z"),
      minSpending: null,
      rate: null,
      points: 100,
    },
  ];

  const promotions = [];
  for (const promo of promotionsData) {
    const created = await prisma.promotion.create({ data: promo });
    promotions.push(created);
  }

  // --- USER ↔ PROMOTION RELATIONS ---
  await prisma.user.update({
    where: { utorid: "asadmir" },
    data: {
      promotions: {
        connect: [{ id: promotions[0].id }, { id: promotions[3].id }],
      },
    },
  });

  await prisma.user.update({
    where: { utorid: "johndoe" },
    data: {
      promotions: {
        connect: [{ id: promotions[1].id }, { id: promotions[2].id }],
      },
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
