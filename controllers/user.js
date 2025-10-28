const { userService } = require("../services/user");
const { tokenService } = require("../services/token");

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

module.exports = { registerUser, getUsers };
