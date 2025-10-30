const { userService } = require("../services/user");
const { tokenService } = require("../services/token");
const { roleHasClearance } = require("../constants");
const { RoleType } = require("@prisma/client");
const { ROLES } = require("../constants");

const registerUser = async (req, res) => {
  const { utorid, name, email } = req.body;

  const {
    valid,
    message,
    utorid: trimmedUtorid,
    name: trimmedName,
    email: normalizedEmail,
  } = userService.validateNewUser({ utorid, name, email });

  if (!valid) return res.status(400).json({ message });

  try {
    const existedUser = await userService.findUserByUtoridOrEmail(
      trimmedUtorid,
      normalizedEmail
    );
    if (existedUser)
      return res.status(409).json({ message: "User already exists" });

    const user = await userService.createBaseUser({
      utorid: trimmedUtorid,
      name: trimmedName,
      email: normalizedEmail,
    });

    const { token: resetToken, expiresAt } =
      await tokenService.generateResetToken(user.id);

    return res.status(201).json({
      id: user.id,
      utorid: user.utorid,
      name: user.name,
      email: user.email,
      verified: user.verified,
      resetToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("registerUser error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUsers = async (req, res) => {
  let { name, role, verified, activated, page, limit } = req.query;

  try {
    if (verified !== undefined) {
      if (verified !== "true" && verified !== "false") {
        return res
          .status(400)
          .json({ message: "Invalid verified value; must be boolean" });
      } else {
        verified = verified === "true";
      }
    }

    if (activated !== undefined) {
      if (activated !== "true" && activated !== "false") {
        return res
          .status(400)
          .json({ message: "Invalid activated value; must be boolean" });
      } else {
        activated = activated === "true";
      }
    }

    page = parseInt(page);
    limit = parseInt(limit);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    const result = await userService.getUsers({
      name,
      role,
      verified,
      activated,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });

    return res.status(200).json({ count: result.total, results: result.users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  const role = req?.auth?.role ? req.auth.role : RoleType.manager;
  try {
    if (role === RoleType.cashier) {
      const user = await userService.cashierFindUserById(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    } else if (roleHasClearance(role, RoleType.manager)) {
      const user = await userService.managerFindUserById(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    }
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUserStatusFields = async (req, res) => {
  const {
    email: updatedEmail,
    verified: updatedVerified,
    suspicious: updatedSuspicious,
    role: updatedRole,
  } = req.body;
  let types = {
    email: "string",
    verified: "boolean",
    suspicious: "boolean",
    role: "enum",
  };
  for (const key in req.body) {
    if (!Object.keys(types).includes(key)) {
      return res
        .status(400)
        .json({ message: `Invalid field in request body: ${key}` });
    } else if (key === "role" && !ROLES.includes(req.body[key])) {
      return res
        .status(400)
        .json({ message: `Invalid value for field role: ${req.body[key]}` });
    } else if (typeof req.body[key] !== types[key] && types[key] !== "enum") {
      return res.status(400).json({
        message: `Invalid type for field ${key}: expected ${types[key]}`,
      });
    }
  }
  const { id: stringId } = req.params;
  const id = parseInt(stringId);
  const authRole = req?.auth?.role ? req.auth.role : RoleType.manager;

  try {
    const user = await userService.managerFindUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (updatedVerified === false) {
      return res.status(400).json({
        message: "Invalid operation. Users cannot be unverified.",
      });
    }
    if (authRole === RoleType.manager) {
      if (
        updatedRole == RoleType.manager ||
        updatedRole == RoleType.superuser
      ) {
        return res.status(400).json({
          message:
            "Invalid role. Managers can only assign roles 'cashier' or 'regular'.",
        });
      } else if (
        updatedRole == RoleType.cashier &&
        user.role == RoleType.regular &&
        (await userService.isUserSuspicious(id))
      ) {
        return res.status(400).json({
          message:
            "Invalid role. Cashiers cannot be assigned to suspicious users.",
        });
      }
    }
    const updatedUser = await userService.updateUserStatusFields(user.id, {
      verified: updatedVerified,
      suspicious: updatedSuspicious,
      role: updatedRole,
      email: updatedEmail,
    });

    return res.status(200).json({ ...updatedUser });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  registerUser,
  getUsers,
  getUserById,
  updateUserStatusFields,
};
