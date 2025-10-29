const { tokenService } = require("../services/token");

const authenticateUser = async (req, res) => {
  const { utorid, password } = req.body;
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

module.exports = { authenticateUser };
