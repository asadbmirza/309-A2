const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();

const EMAIL_FINISH = "@mail.utoronto.ca";
const MAX_NAME_LEN = 50;
const generalEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stringLengthValid = (str, min, max) => {
  return typeof str === "string" && str.length >= min && str.length <= max;
};

const registerUser = async (req, res) => {
  let { utorid, name, email } = req.body || {};

  if (!utorid || !name || !email) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  utorid = utorid?.trim();
  name = name?.trim();
  email = email?.trim().toLowerCase();
  
  // Length limits
  if (
    !stringLengthValid(utorid, 7, 8) ||
    !stringLengthValid(name, 1, MAX_NAME_LEN) ||
    email.length === 0 ||
    !email.endsWith(EMAIL_FINISH) ||
    !generalEmailRegex.test(email)
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const existedUser = await prisma.user.findFirst({
      where: { OR: [{ utorid }, { email }] },
    });
    if (existedUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = await prisma.user.create({
      data: {
        utorid,
        name,
        email,
        verified: false,
        password: null,
      },
    });

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await prisma.resetToken.create({
      data: {
        token: resetToken,
        expiresAt,
        userId: user.id,
      },
    });

    return res.status(201).json({
      id: user.id,
      utorid: user.utorid,
      name: user.name,
      email: user.email,
      verified: user.verified,
      expiresAt: expiresAt.toISOString(),
      resetToken,
    });
  } catch (err) {
    console.error("registerUser error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { registerUser };
