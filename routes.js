const express = require("express");
const userController = require("./controllers/user");
const userRouter = express.Router();

userRouter.post("/", userController.registerUser); //TODO: add clearance check middleware when needed
userRouter.get("/", userController.getUsers); //TODO: add clearance check middleware when needed
userRouter.get("/:id", userController.getUserById); //TODO: add clearance check middleware when needed

module.exports = [userRouter];
