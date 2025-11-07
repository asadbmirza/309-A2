const { tokenService } = require("../services/token");
const { validateService } = require("../services/validate_service");
const { userService } = require("../services/user");

const authenticateUser = async (req, res) => {
  let { utorid, password } = req.body;
  const requiredKeys = ["utorid", "password"];
  const requiredValidation = validateService.validateObjHasRequiredKeys(
    req.body,
    requiredKeys
  );
  if (!requiredValidation.valid) {
    return res.status(400).json({ message: requiredValidation.message });
  }
  const objKeyValidation = validateService.validateObjHasCorrectKeys(
    req.body,
    requiredKeys
  );
  if (!objKeyValidation.valid) {
    return res.status(400).json({ message: objKeyValidation.message });
  }

  try {
    const user = await tokenService.login(utorid, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const { token, expiresAt } = tokenService.generateJwtToken(
      user.id,
      user.role,
      user.utorid
    );
    return res.status(200).json({ token, expiresAt });
  } catch (error) {
    console.error("Error authenticating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const requests = new Map();

const initiatePasswordReset = async (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const last = requests.get(ip);
  if (last && now - last < 60000) {
    return res
      .status(429)
      .json({ message: "Too many requests. Please try again later." });
  }
  requests.set(ip, now);

  const { utorid } = req.body;
  const requiredKeys = ["utorid"];
  const requiredValidation = validateService.validateObjHasRequiredKeys(
    req.body,
    requiredKeys
  );

  if (!requiredValidation.valid) {
    return res.status(400).json({ message: requiredValidation.message });
  }
  const objKeyValidation = validateService.validateObjHasCorrectKeys(
    req.body,
    requiredKeys
  );
  if (!objKeyValidation.valid) {
    return res.status(400).json({ message: objKeyValidation.message });
  }

  try {
    const user = await userService.findUserByUtorid(utorid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { token, expiresAt } = await tokenService.generateResetToken(user.id);
    return res.status(200).json({ resetToken: token, expiresAt });
  } catch (error) {
    console.error("Error initiating password reset:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  const { resetToken } = req.params;
  const requiredKeys = ["password", "utorid"];
  const requiredValidation = validateService.validateObjHasRequiredKeys(
    req.body,
    requiredKeys
  );
  if (!requiredValidation.valid) {
    return res.status(400).json({ message: requiredValidation.message });
  }
  const objKeyValidation = validateService.validateObjHasCorrectKeys(
    req.body,
    requiredKeys
  );
  if (!objKeyValidation.valid) {
    return res.status(400).json({ message: objKeyValidation.message });
  }
  const { password: potentialPassword, utorid } = req.body;

  const {
    password,
    valid: validPassword,
    message: passwordMessage,
  } = validateService.validatePassword(potentialPassword);
  if (!validPassword) {
    return res.status(400).json({ message: passwordMessage });
  }
  const { valid: validUtorid, message: utoridMessage } =
    validateService.validateUtorid(utorid);
  if (!validUtorid) {
    return res.status(400).json({ message: utoridMessage });
  }

  try {
    const token = await tokenService.findTokenByUtorid(utorid);
    if (!token || token.token !== resetToken) {
      return res.status(404).json({ message: "Invalid or non-existent token" });
    }
    if (new Date() > token.expiresAt) {
      return res.status(410).json({ message: "Reset token has expired" });
    }
    await userService.updateUserPassword(utorid, password);
    await tokenService.deleteResetToken(token.id);
    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { authenticateUser, initiatePasswordReset, resetPassword };
