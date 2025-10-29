const express = require("express");
const userController = require("./controllers/user");
const authController = require("./controllers/auth");
const userRouter = express.Router();
const authRouter = express.Router();
const { verifyUserRole } = require("./middleware/auth");
const { RoleType } = require("@prisma/client");

// user routes
userRouter.post("/", verifyUserRole(RoleType.cashier), userController.registerUser); //TODO: add clearance check middleware when needed
userRouter.get("/", verifyUserRole(RoleType.manager), userController.getUsers); //TODO: add clearance check middleware when needed
userRouter.get("/:id", verifyUserRole(RoleType.cashier), userController.getUserById); //TODO: add clearance check middleware when needed

// auth routes
authRouter.post("/tokens", authController.authenticateUser);

module.exports = { userRouter, authRouter };
