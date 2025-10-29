const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();
const { v4: uuidv4 } =  require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
dotenv = require('dotenv');
dotenv.config();

const tokenService = {
  generateResetToken: async (userId) => {
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() +  1 * 3600 * 1000); // 1 hour

    await prisma.resetToken.create({
      data: {
        token: resetToken,
        expiresAt,
        userId,
      },
    });

    return { token: resetToken, expiresAt };
  },

  generateJwtToken: (userId, role, utorid) => {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours
    const token = jwt.sign({ userId, role, utorid }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    return { token, expiresAt: expiresAt.toISOString() };
  },

  verifyJwtToken: (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (err) {
        return null;
    }
  },
  login: async (utorid, password) => {
    const user = await prisma.user.findUnique({
      where: { utorid },
    });
    if (!user || !user.password) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }
  // flow is login -> generateJwtToken -> verifyJwtToken for protected routes
};

module.exports = { tokenService };
