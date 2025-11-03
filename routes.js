const express = require("express");
const userController = require("./controllers/user");
const authController = require("./controllers/auth");
const eventsController = require("./controllers/events");
const userRouter = express.Router();
const authRouter = express.Router();
const eventsRouter = express.Router();
const { verifyUserRole } = require("./middleware/auth");
const { RoleType } = require("@prisma/client");

// user routes
userRouter.post(
  "/",
  verifyUserRole(RoleType.cashier),
  userController.registerUser
);
userRouter.get("/", verifyUserRole(RoleType.manager), userController.getUsers);
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

userRouter.all("/", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
userRouter.all("/:id", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

// auth routes
authRouter.post("/tokens", authController.authenticateUser);

authRouter.all("/tokens", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});


// events routes
eventsRouter.post("/", verifyUserRole(RoleType.manager), eventsController.createEvent);
eventsRouter.all("/", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

module.exports = { userRouter, authRouter, eventsRouter };
