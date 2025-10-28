const express = require('express');
const userController = require('./controllers/user');
const userRouter = express.Router();

userRouter.post('/', userController.registerUser);
userRouter.get('/', userController.getUsers);

module.exports = [userRouter];
