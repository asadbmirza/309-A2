const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();
const { v4: uuidv4 } =  require("uuid");

const tokenService = {
  generateResetToken: async (userId) => {
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await prisma.resetToken.create({
      data: {
        token: resetToken,
        expiresAt,
        userId,
      },
    });

    return { token: resetToken, expiresAt };
  },
};

module.exports = { tokenService };
