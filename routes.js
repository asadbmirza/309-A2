const express = require('express');
const userController = require('./controllers/user');
const userRouter = express.Router();

userRouter.post('/', userController.registerUser);

module.exports = [userRouter];
