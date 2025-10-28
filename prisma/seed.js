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
