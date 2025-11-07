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
    const ip = req.ip;
    const now = Date.now();
    const last = requests.get(ip);

    if (last && now - last < 60000) {
      return res
        .status(429)
        .json({ message: "Too many requests. Please try again later." });
    }
    await tokenService.deleteExistingResetTokensForUser(user.id);
    requests.set(ip, now);
    const { token, expiresAt } = await tokenService.generateResetToken(user.id);
    return res.status(202).json({ resetToken: token, expiresAt });
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
    const exactToken = await tokenService.findTokenByToken(resetToken);
    if (!exactToken) {
      return res.status(404).json({ message: "Invalid or non-existent token" });
    }
    const { id: user_id } = await userService.findUserByUtorid(utorid);
    if (exactToken.userId !== user_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (new Date() > new Date(exactToken.expiresAt)) {
      return res.status(410).json({ message: "Reset token has expired" });
    }
    await userService.updateUserPassword(utorid, password);
    await tokenService.deleteResetToken(exactToken.id);
    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { authenticateUser, initiatePasswordReset, resetPassword };
