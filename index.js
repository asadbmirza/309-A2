#!/usr/bin/env node
const { authRouter, userRouter, eventsRouter, promotionsRouter } = require('./routes');
const { authenticateJWT } = require('./middleware/auth');

'use strict';

const port = (() => {
    const args = process.argv;

    if (args.length !== 3) {
        console.error("usage: node index.js port");
        process.exit(1);
    }

    const num = parseInt(args[2], 10);
    if (isNaN(num)) {
        console.error("error: argument must be an integer.");
        process.exit(1);
    }

    return num;
})();

const express = require("express");
const path = require("path");
const multer = require("multer");
const app = express();

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ADD YOUR WORK HERE
app.use('/users', authenticateJWT, userRouter);
app.use('/auth', authRouter);
app.use('/events', authenticateJWT, eventsRouter);
app.use('/promotions', authenticateJWT, promotionsRouter);

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
});