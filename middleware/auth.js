const donenv = require('dotenv');
donenv.config();
const jwt = require('jsonwebtoken');
const { ROLES } = require('../constants');

const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET);
            req.user = user;
            req.auth = { role: user.role };
        } catch (err) {
            return res.sendStatus(403);
        }
        next();
    } else {
        res.sendStatus(401);
    }
};

const verifyUserRole = (requiredRole) => {
    return (req, res, next) => {
        const userRole = req.auth.role;
        if (ROLES.indexOf(userRole) >= ROLES.indexOf(requiredRole)) {
            next();
        } else {
            res.sendStatus(403);
        }
    };
};

module.exports = { authenticateJWT, verifyUserRole };
