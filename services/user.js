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
  cashierFindUserById: async (id) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        utorid: true,
        name: true,
        points: true,
        verified: true,
        promotions: {
          select: {
            id: true,
            name: true,
            minSpending: true,
            rate: true,
            points: true,
          },
        },
      },
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
  getUsers: async ({
    name,
    role,
    verified,
    activated,
    page = 1,
    limit = 10,
  }) => {
    const where = {};

    if (name) where.name = name;
    if (role) where.role = role;
    if (verified !== undefined) where.verified = verified;
    if (activated !== undefined)
      activated ? (where.lastLogin = { not: null }) : (where.lastLogin = null);

    const users = await prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = users?.length || 0;

    return {
      users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },
};

module.exports = { userService };
