const express = require("express");
const userController = require("./controllers/user");
const authController = require("./controllers/auth");
const transactionController = require("./controllers/transactions");
const userRouter = express.Router();
const authRouter = express.Router();
const transactionRouter = express.Router();
const { verifyUserRole } = require("./middleware/auth");
const { RoleType } = require("@prisma/client");
const { upload } = require("./middleware/upload");

// user routes
userRouter.post(
  "/",
  verifyUserRole(RoleType.cashier),
  userController.registerUser
);
userRouter.get("/", verifyUserRole(RoleType.manager), userController.getUsers);
userRouter.patch(
  "/me",
  verifyUserRole(RoleType.regular),
  upload.single("avatar"),
  userController.updatePersonalProfile
);
userRouter.patch(
  "/me/password",
  verifyUserRole(RoleType.regular),
  userController.updatePersonalPassword
);
userRouter.get(
  "/:id",
  verifyUserRole(RoleType.cashier),
  userController.getUserById
);
userRouter.patch(
  "/:id",
  verifyUserRole(RoleType.manager),
  userController.updateUserStatusFields
);
userRouter.post(
  "/me/transactions",
  verifyUserRole(RoleType.regular),
  userController.createUserRedemption
);
userRouter.get(
  "/me/transactions",
  verifyUserRole(RoleType.regular),
  userController.getUserTransactions
);
userRouter.post(
  "/:userId/transactions",
  verifyUserRole(RoleType.regular),
  userController.createUserTransaction
);

userRouter.all("/", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/:id", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/me", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/me/password", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/:userId/transactions", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/users/me/transactions", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

// auth routes
authRouter.post("/tokens", authController.authenticateUser);
authRouter.post("/resets", authController.initiatePasswordReset);
authRouter.post("/resets/:resetToken", authController.resetPassword);

authRouter.all("/tokens", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
authRouter.all("/resets", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
authRouter.all("/resets/:resetToken", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

// transactions routes
transactionRouter.post(
  "/",
  verifyUserRole(RoleType.cashier),
  transactionController.createTransaction
);
transactionRouter.get(
  "/",
  verifyUserRole(RoleType.manager),
  transactionController.getTransactions
);
transactionRouter.get(
  "/:transactionId",
  verifyUserRole(RoleType.manager),
  transactionController.getTransactionById
);
transactionRouter.patch(
  "/:transactionId/suspicious",
  verifyUserRole(RoleType.manager),
  transactionController.markTransactionSuspicious
);
transactionRouter.patch(
  "/:transactionId/processed",
  verifyUserRole(RoleType.cashier),
  transactionController.markTransactionProcessed
);

// fallback for unsupported methods on the collection
transactionRouter.all("/", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
transactionRouter.all("/:transactionId", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
transactionRouter.all("/:transactionId/suspicious", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
transactionRouter.all("/:transactionId/processed", (_req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

module.exports = { userRouter, authRouter, transactionRouter };
