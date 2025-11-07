const { userService } = require("../services/user");
const { tokenService } = require("../services/token");
const { validateService } = require("../services/validate_service");
const { transactionService } = require("../services/transactions");
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
  } = validateService.validateNewUser({ utorid, name, email });

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

  let updatedEmail, updatedVerified, updatedSuspicious, updatedRole;

  if (newEmail !== undefined) {
    const {
      valid: validEmail,
      message: emailMessage,
      email: validatedEmail,
    } = validateService.validateEmail(newEmail);
    if (!validEmail) return res.status(400).json({ message: emailMessage });
    updatedEmail = validatedEmail;
  }

  if (newVerified !== undefined) {
    const {
      valid: validVerified,
      message: verifiedMessage,
      verified: validatedVerified,
    } = validateService.validateVerified(newVerified);
    if (!validVerified)
      return res.status(400).json({ message: verifiedMessage });
    updatedVerified = validatedVerified;
  }

  if (newSuspicious !== undefined) {
    const {
      valid: validSuspicious,
      message: suspiciousMessage,
      suspicious: validatedSuspicious,
    } = validateService.validateSuspicious(newSuspicious);
    if (!validSuspicious)
      return res.status(400).json({ message: suspiciousMessage });
    updatedSuspicious = validatedSuspicious;
  }

  if (newRole !== undefined) {
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
        updatedRole === RoleType.manager ||
        updatedRole === RoleType.superuser
      ) {
        return res.status(400).json({
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
  const updatedAvatar = req.file ? `/uploads/${req.file.filename}` : undefined;

  const { valid: validObjKeys, message: objKeysMessage } =
    validateService.validateObjHasCorrectKeys(req.body, [
      "name",
      "email",
      "birthday",
    ]);
  if (!validObjKeys) return res.status(400).json({ message: objKeysMessage });

  let updatedName, updatedEmail, updatedBirthday;

  if (newName !== undefined) {
    const {
      valid: validName,
      message: nameMessage,
      name: validatedName,
    } = validateService.validateName(newName);
    if (!validName) return res.status(400).json({ message: nameMessage });
    updatedName = validatedName;
  }

  if (newEmail !== undefined) {
    const {
      valid: validEmail,
      message: emailMessage,
      email: validatedEmail,
    } = validateService.validateEmail(newEmail);
    if (!validEmail) return res.status(400).json({ message: emailMessage });
    updatedEmail = validatedEmail;
  }

  if (newBirthday !== undefined) {
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
    if (updatedEmail !== undefined) {
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
  if (!validPassword) return res.status(400).json({ message: passwordMessage });

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

const createUserTransaction = async (req, res) => {
  try {
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeysAndType(req.body, {
      type: "string",
      amount: "number",
      remark: "string",
    });
    if (!valid) return res.status(400).json({ error: message });

    const { type, amount, remark } = parsedData;
    if (type !== "transfer") {
      return res
        .status(400)
        .json({ error: "Only 'transfer' type supported at this endpoint" });
    }

    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    let recipientId = req.params.userId;
    if (recipientId === undefined) {
      return res
        .status(400)
        .json({ error: "Recipient userId is required in the path" });
    }

    const senderUtorid = req.utorid;

    const { data, error } = await transactionService.createTransferTransaction({
      senderUtorid,
      recipientId,
      amt,
      remark,
    });

    if (error) {
      const msg = error.message || "Internal Server Error";
      if (msg === "Sender not verified") {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (msg === "Insufficient points") {
        return res.status(400).json({ message: msg });
      }
      if (msg === "Recipient not found" || msg === "Sender not found") {
        return res.status(404).json({ message: msg });
      }
      return res.status(400).json({ message: msg });
    }

    // return the sender transaction representation
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createUserRedemption = async (req, res) => {
  try {
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeysAndType(req.body, {
      type: "string",
      amount: "number",
      remark: "string",
    });

    const { valid: reqBodyValid, message: reqBodyMessage } =
      validateService.validateObjHasRequiredKeys(req.body, ["type", "amount"]);

    if (!valid || !reqBodyValid)
      return res.status(400).json({ error: message || reqBodyMessage });

    if (parsedData.type !== "redemption") {
      return res
        .status(400)
        .json({ error: "Only 'redemption' type supported at this endpoint" });
    }

    if (!Number.isInteger(parsedData.amount) || parsedData.amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const { data, error } =
      await transactionService.createRedemptionTransaction({
        userId: req.utorid,
        amount: parsedData.amount,
        description: parsedData.remark || "",
      });

    if (error) {
      const msg = error.message || "Internal Server Error";
      if (msg === "User not verified") {
        return res.status(403).json({ message: msg });
      }
      return res.status(400).json({ message: msg });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getUserTransactions = async (req, res) => {
  try {
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeys(req.query, [
      "type",
      "relatedId",
      "promotionId",
      "amount",
      "operator",
      "page",
      "limit",
    ]);

    if (!valid) return res.status(400).json({ message });
  
    const q = parsedData || {};

    // type: optional string
    if (q.type !== undefined && typeof q.type !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for type; expected string" });
    }

    // relatedId: optional positive integer
    if (q.relatedId !== undefined) {
      const r = Number(q.relatedId);
      if (Number.isNaN(r) || !Number.isInteger(r) || r <= 0) {
        return res
          .status(400)
          .json({
            error: "Invalid type for relatedId; expected positive integer",
          });
      }
      q.relatedId = r;
    }

    // amount: optional number
    if (q.amount !== undefined) {
      const a = Number(q.amount);
      if (Number.isNaN(a)) {
        return res
          .status(400)
          .json({ error: "Invalid type for amount; expected number" });
      }
      q.amount = a;
    }

    // operator: optional string
    if (q.operator !== undefined && typeof q.operator !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for operator; expected string" });
    }

    // page: optional positive integer
    if (q.page !== undefined) {
      const pg = Number(q.page);
      if (Number.isNaN(pg) || !Number.isInteger(pg) || pg <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid type for page; expected positive integer" });
      }
      q.page = pg;
    }

    // limit: optional positive integer
    if (q.limit !== undefined) {
      const l = Number(q.limit);
      if (Number.isNaN(l) || !Number.isInteger(l) || l <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid type for limit; expected positive integer" });
      }
      q.limit = l;
    }

    if (parsedData.amount && !parsedData.operator) {
      return res
        .status(400)
        .json({ error: "Operator is required when filtering by amount" });
    }

    if (parsedData.relatedId && !parsedData.type) {
      return res
        .status(400)
        .json({ error: "Type is required when filtering by relatedId" });
    }

    if (parsedData.operator && !parsedData.amount) {
      return res
        .status(400)
        .json({ error: "Amount is required when filtering by operator" });
    }

    if (
      parsedData.operator &&
      parsedData.operator !== "gte" &&
      parsedData.operator !== "lte"
    ) {
      return res.status(400).json({ error: "Invalid operator" });
    }

    const utorid = req.utorid;

    const { data, error } = await transactionService.getUserTransactions({
      utorid,
      type: parsedData.type,
      relatedId: parsedData.relatedId,
      promotionId: parsedData.promotionId,
      amount: parsedData.amount,
      operator: parsedData.operator,
      page: parsedData.page,
      limit: parsedData.limit,
    });

    if (error) {
      const msg = error.message || "Internal Server Error";
      if (msg === "User not found")
        return res.status(404).json({ message: msg });
      return res.status(400).json({ message: msg });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("getUserTransactions error:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  registerUser,
  getUsers,
  getUserById,
  updateUserStatusFields,
  updatePersonalProfile,
  updatePersonalPassword,
  createUserTransaction,
  createUserRedemption,
  getUserTransactions,
};
