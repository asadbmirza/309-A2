/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example:
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
"use strict";
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const [utorid, password] = process.argv.slice(2);

  if (!utorid || !password) {
    console.error("Usage: node prisma/createsu.js <utorid> <password>");
    process.exitCode = 1;
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const existing = await prisma.user.findFirst({
      where: { username: utorid },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hashed,
          role: "superuser",
          verified: true,
        },
      });

      console.log(
        `Updated existing user '${utorid}' to role superuser and marked verified.`
      );
    } else {
      await prisma.user.create({
        data: {
          username: utorid,
          password: hashed,
          role: "superuser",
          verified: true,
        },
      });

      console.log(`Created superuser '${utorid}' (verified).`);
    }
  } catch (err) {
    console.error("Error creating/updating superuser:", err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
