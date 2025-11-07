const { PrismaClient } = require("@prisma/client");
const { validateService } = require("./validate_service");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const userService = {
  validateNewUser: ({ utorid, name, email }) => {
    const validUtorid = validateService.validateUtorid(utorid);
    const validName = validateService.validateName(name);
    const validEmail = validateService.validateEmail(email);
    if (!validUtorid.valid) {
      return { valid: false, message: validUtorid.message };
    }
    if (!validName.valid) {
      return { valid: false, message: validName.message };
    }
    if (!validEmail.valid) {
      return { valid: false, message: validEmail.message };
    }

    return {
      valid: true,
      utorid: validUtorid.utorid,
      name: validName.name,
      email: validEmail.email,
    };
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
  findUserByUtorid: async (utorid) => {
    return prisma.user.findUnique({
      where: { utorid },
      select: {
        id: true,
        utorid: true,
      },
    });
  },
  findUserByEmail: async (email) => {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        utorid: true,
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

  fullClearanceFindUserById: async (id) => {
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

    const total = await prisma.user.count({ where });

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
    const ret = { id: user.id, utorid: user.utorid, name: user.name };
    if (email !== undefined) ret.email = user.email;
    if (verified !== undefined) ret.verified = user.verified;
    if (suspicious !== undefined) ret.suspicious = user.suspicious;
    if (role !== undefined) ret.role = user.role;

    return ret;
  },

  updateUserProfile: async (id, { name, email, birthday, avatarUrl }) => {
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (birthday !== undefined) {
      updateFields.birthday = new Date(birthday);
    }
    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id },
      data: updateFields,
      select: {
        id: true,
        utorid: true,
        name: true,
        email: true,
        birthday: true,
        role: true,
        points: true,
        createdAt: true,
        lastLogin: true,
        verified: true,
        avatarUrl: true,
      },
    });

    return user;
  },

  verifyUserPassword: async (utorid, password) => {
    const user = await prisma.user.findUnique({
      where: { utorid },
      select: { password: true },
    });

    if (!user) return false;

    const isMatch = bcrypt.compare(password, user.password);
    return isMatch;
  },

  updateUserPassword: async (utorid, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({
      where: { utorid },
      data: { password: hashedPassword },
      select: { id: true, utorid: true },
    });

    return { id: user.id, utorid: user.utorid };
  },
};

module.exports = { userService };
