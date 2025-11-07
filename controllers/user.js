const { userService } = require("../services/user");
const { tokenService } = require("../services/token");
const { validateService } = require("../services/validate_service");
const { roleHasClearance } = require("../constants");
const { RoleType } = require("@prisma/client");

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
    if (isNaN(page)) page = 1;
    if (isNaN(limit)) limit = 10;
    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json({ message: "Page and limit must be positive integers" });
    }
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
      const user = await userService.fullClearanceFindUserById(parseInt(id));
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
    email: newEmail,
    verified: newVerified,
    suspicious: newSuspicious,
    role: newRole,
  } = req.body;

  const { valid: validObjKeys, message: objKeysMessage } =
    validateService.validateObjHasCorrectKeys(req.body, [
      "email",
      "verified",
      "suspicious",
      "role",
    ]);
  if (!validObjKeys) return res.status(400).json({ message: objKeysMessage });
  if (Object.keys(req.body).length === 0) {
    return res
      .status(400)
      .json({ message: "At least one field must be provided for update" });
  }
  let updatedEmail, updatedVerified, updatedSuspicious, updatedRole;

  if (newEmail !== undefined && newEmail !== null) {
    const {
      valid: validEmail,
      message: emailMessage,
      email: validatedEmail,
    } = validateService.validateEmail(newEmail);
    if (!validEmail) return res.status(400).json({ message: emailMessage });
    updatedEmail = validatedEmail;
  }

  if (newVerified !== undefined && newVerified !== null) {
    const {
      valid: validVerified,
      message: verifiedMessage,
      verified: validatedVerified,
    } = validateService.validateVerified(newVerified);
    if (!validVerified)
      return res.status(400).json({ message: verifiedMessage });
    updatedVerified = validatedVerified;
  }

  if (newSuspicious !== undefined && newSuspicious !== null) {
    const {
      valid: validSuspicious,
      message: suspiciousMessage,
      suspicious: validatedSuspicious,
    } = validateService.validateSuspicious(newSuspicious);
    if (!validSuspicious)
      return res.status(400).json({ message: suspiciousMessage });
    updatedSuspicious = validatedSuspicious;
  }

  if (newRole !== undefined && newRole !== null) {
    const {
      valid: validRole,
      message: roleMessage,
      role: validatedRole,
    } = validateService.validateRole(newRole);
    if (!validRole) return res.status(400).json({ message: roleMessage });
    updatedRole = validatedRole;
  }

  const { id: stringId } = req.params;
  const id = parseInt(stringId);
  const authRole = req?.auth?.role ? req.auth.role : RoleType.manager;

  try {
    const user = await userService.fullClearanceFindUserById(id);
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
        updatedRole === RoleType.manager ||
        updatedRole === RoleType.superuser
      ) {
        return res.status(403).json({
          message:
            "Invalid role. Managers can only assign roles 'cashier' or 'regular'.",
        });
      } else if (
        updatedRole === RoleType.cashier &&
        user.role === RoleType.regular
      ) {
        const finalSuspicious =
          updatedSuspicious !== undefined ? updatedSuspicious : user.suspicious;
        if (finalSuspicious) {
          return res.status(400).json({
            message:
              "Invalid role. Cashiers cannot be assigned to suspicious users.",
          });
        }
      }
    }

    if (updatedEmail !== undefined) {
      const existingUser = await userService.findUserByEmail(updatedEmail);
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const updatedUser = await userService.updateUserStatusFields(user.id, {
      verified: updatedVerified,
      suspicious: updatedSuspicious,
      role: updatedRole,
      email: updatedEmail,
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updatePersonalProfile = async (req, res) => {
  const userId = req.userId;
  const { name: newName, email: newEmail, birthday: newBirthday } = req.body;
  console.log("req.body:", req.body);
  const updatedAvatar = req.file ? `/uploads/${req.file.filename}` : undefined;
  console.log("Received avatar file:", req.file);

  const { valid: validObjKeys, message: objKeysMessage } =
    validateService.validateObjHasCorrectKeys(req.body, [
      "name",
      "email",
      "birthday",
      "avatar",
    ]);
  if (!validObjKeys || (Object.keys(req.body).length === 0 && !updatedAvatar))
    return res.status(400).json({ message: objKeysMessage });

  let updatedName, updatedEmail, updatedBirthday;

  if (newName !== undefined && newName !== null) {
    const {
      valid: validName,
      message: nameMessage,
      name: validatedName,
    } = validateService.validateName(newName);
    if (!validName) return res.status(400).json({ message: nameMessage });
    updatedName = validatedName;
  }

  if (newEmail !== undefined && newEmail !== null) {
    const {
      valid: validEmail,
      message: emailMessage,
      email: validatedEmail,
    } = validateService.validateEmail(newEmail);
    if (!validEmail) return res.status(400).json({ message: emailMessage });
    updatedEmail = validatedEmail;
  }

  if (newBirthday !== undefined && newBirthday !== null) {
    const {
      valid: validBirthday,
      message: birthdayMessage,
      birthday: validatedBirthday,
    } = validateService.validateBirthday(newBirthday);
    if (!validBirthday)
      return res.status(400).json({ message: birthdayMessage });
    updatedBirthday = validatedBirthday;
  }

  try {
    if (updatedEmail !== undefined && updatedEmail !== null) {
      const existingUser = await userService.findUserByEmail(updatedEmail);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const updatedUser = await userService.updateUserProfile(userId, {
      name: updatedName,
      email: updatedEmail,
      birthday: updatedBirthday,
      avatarUrl: updatedAvatar,
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating personal profile:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updatePersonalPassword = async (req, res) => {
  const requiredKeys = ["old", "new"];
  const { valid: corObjValid, message: corObjMsg } =
    validateService.validateObjHasCorrectKeys(req.body, requiredKeys);
  if (!corObjValid) return res.status(400).json({ message: corObjMsg });

  const { obj: reqObjValid, message: reqObjMsg } =
    validateService.validateObjHasRequiredKeys(req.body, requiredKeys);
  if (!reqObjValid) return res.status(400).json({ message: reqObjMsg });

  const utorid = req.utorid;
  const { old: oldPassword, new: potentialPassword } = req.body;
  const {
    valid: validPassword,
    message: passwordMessage,
    password: newPassword,
  } = validateService.validatePassword(potentialPassword);
  if (!validPassword || typeof oldPassword !== "string")
    return res.status(400).json({ message: passwordMessage });

  try {
    const verifyPassword = await userService.verifyUserPassword(
      utorid,
      oldPassword
    );

    if (!verifyPassword) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await userService.updateUserPassword(utorid, newPassword);

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getPersonalProfile = async (req, res) => {
  const userId = req.userId;

  try {
    const userProfile = await userService.fullClearanceFindUserById(userId);
    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error fetching personal profile:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  registerUser,
  getUsers,
  getUserById,
  updateUserStatusFields,
  updatePersonalProfile,
  updatePersonalPassword,
  getPersonalProfile,
};
