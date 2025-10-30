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

  isUserSuspicious: async (id) => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { suspicious: true },
    });
    return user?.suspicious || false;
  },

  findUserByUtoridOrEmail: async (utorid, email) => {
    return prisma.user.findFirst({
      where: { OR: [{ utorid }, { email }] },
      select: {
        id: true,
        utorid: true,
        name: true,
        email: true,
        points: true,
        verified: true,
        birthday: true,
        createdAt: true,
        lastLogin: true,
        avatarUrl: true,
        role: true,
      },
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

  managerFindUserById: async (id) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        utorid: true,
        name: true,
        email: true,
        points: true,
        verified: true,
        birthday: true,
        createdAt: true,
        lastLogin: true,
        avatarUrl: true,
        role: true,
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
  updateUserStatusFields: async (id, { email, verified, suspicious, role }) => {
    const updateFields = {};
    if (email !== undefined) updateFields.email = email;
    if (verified !== undefined) updateFields.verified = verified;
    if (suspicious !== undefined) updateFields.suspicious = suspicious;
    if (role !== undefined) updateFields.role = role;

    const user = await prisma.user.update({
      where: { id },
      data: updateFields,
    });
    const ret = {id: user.id, utorid: user.utorid};
    if (email !== undefined) ret.email = user.email;
    if (verified !== undefined) ret.verified = user.verified;
    if (suspicious !== undefined) ret.suspicious = user.suspicious;
    if (role !== undefined) ret.role = user.role;

    return ret;
  },
};

module.exports = { userService };
