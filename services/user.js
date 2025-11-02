const { PrismaClient } = require("@prisma/client");
const {
  stringLengthValid,
  MAX_NAME_LEN,
  EMAIL_FINISH,
  generalEmailRegex,
} = require("../utils");
const { ROLES } = require("../constants");

const prisma = new PrismaClient();

const userService = {
  validateEmail: (email) => {
    if (typeof email !== "string") {
      return { valid: false, message: "Invalid email" };
    }
    email = email.trim().toLowerCase();
    if (
      !email ||
      !email.endsWith(EMAIL_FINISH) ||
      !generalEmailRegex.test(email)
    ) {
      return { valid: false, message: "Invalid email" };
    }
    return { valid: true, email };
  },
  validateName: (name) => {
    if (typeof name !== "string") {
      return { valid: false, message: "Invalid name" };
    }
    name = name.trim();
    if (!name || !stringLengthValid(name, 1, MAX_NAME_LEN)) {
      return { valid: false, message: "Invalid name" };
    }
    return { valid: true, name };
  },
  validateUtorid: (utorid) => {
    if (typeof utorid !== "string") {
      return { valid: false, message: "Invalid utorid" };
    }
    utorid = utorid.trim();
    if (!utorid || !stringLengthValid(utorid, 7, 8)) {
      return { valid: false, message: "Invalid utorid" };
    }
    return { valid: true, utorid };
  },

  validateBirthday: (birthday) => {
    if (typeof birthday !== "string") {
      return { valid: false, message: "Invalid birthday" };
    }
    birthday = birthday.trim();
    // Check for YYYY-MM-DD format
    const birthRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthday || !birthRegex.test(birthday)) {
      return {
        valid: false,
        message: "Invalid birthday format. Use YYYY-MM-DD.",
      };
    }

    const date = new Date(birthday + "T00:00:00"); // add time to avoid timezone issues
    if (isNaN(date.getTime())) {
      return { valid: false, message: "Invalid date" };
    }

    const [year, month, day] = birthday.split("-").map(Number);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return { valid: false, message: "Invalid date" };
    }

    return { valid: true, birthday };
  },
  validateRole: (role) => {
    if (typeof role !== "string") {
      return { valid: false, message: "Invalid role" };
    }
    role = role.trim();
    if (!ROLES.includes(role)) {
      return { valid: false, message: "Invalid role" };
    }
    return { valid: true, role };
  },
  validateVerified: (verified) => {
    if (typeof verified !== "boolean") {
      return { valid: false, message: "Invalid verified" };
    }
    return { valid: true, verified };
  },
  validateSuspicious: (suspicious) => {
    if (typeof suspicious !== "boolean") {
      return { valid: false, message: "Invalid suspicious" };
    }
    return { valid: true, suspicious };
  },
  validateNewUser: ({ utorid, name, email }) => {
    const validUtorid = userService.validateUtorid(utorid);
    const validName = userService.validateName(name);
    const validEmail = userService.validateEmail(email);
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

  validateObjHasCorrectKeys: (obj, requiredKeys) => {
    console.log(obj, requiredKeys);
    for (const key of Object.keys(obj)) {
      if (!requiredKeys.includes(key)) {
        return { valid: false, message: `Invalid field: ${key}` };
      }
    }
    return { valid: true, obj };
  },

  validateObjHasRequiredKeys: (obj, requiredKeys) => {
    for (const key of requiredKeys) {
      if (!obj.hasOwnProperty(key)) {
        return { valid: false, message: `Missing required field: ${key}` };
      }
    }
    return { valid: true, obj };
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
    const ret = { id: user.id, utorid: user.utorid };
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
};

module.exports = { userService };
