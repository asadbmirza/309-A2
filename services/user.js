const { PrismaClient } = require("@prisma/client");
const {
  stringLengthValid,
  MAX_NAME_LEN,
  EMAIL_FINISH,
  generalEmailRegex,
} = require("../utils");

const prisma = new PrismaClient();

const userService = {
  validateNewUser: ({ utorid, name, email }) => {
    utorid = utorid?.trim();
    name = name?.trim();
    email = email?.trim().toLowerCase();

    if (!utorid || !name || !email) {
      return { valid: false, message: "Missing required fields" };
    }

    if (
      !stringLengthValid(utorid, 7, 8) ||
      !stringLengthValid(name, 1, MAX_NAME_LEN) ||
      email.length === 0 ||
      !email.endsWith(EMAIL_FINISH) ||
      !generalEmailRegex.test(email)
    ) {
      return { valid: false, message: "Invalid input" };
    }

    return { valid: true, utorid, name, email };
  },

  findUserByUtoridOrEmail: async (utorid, email) => {
    return prisma.user.findFirst({
      where: { OR: [{ utorid }, { email }] },
    });
  },

  createBaseUser: async ({ utorid, name, email }) => {
    return prisma.user.create({
      data: {
        utorid,
        name,
        email,
        verified: false,
        password: null,
      },
    });
  },
};

module.exports = { userService };