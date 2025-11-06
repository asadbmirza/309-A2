const donenv = require("dotenv");
donenv.config();
const { roleHasClearance } = require("../constants");
const { tokenService } = require("../services/token");
const eventService = require("../services/events");
const { RoleType } = require("@prisma/client");

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("headers:", req.headers);
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const { userId, utorid, role } = tokenService.verifyJwtToken(token);
      if (!userId || !utorid || !role) {
        return res.sendStatus(403);
      }
      console.log("Authenticated user:", { userId, utorid, role });
      req.userId = userId;
      req.utorid = utorid;
      req.auth = { role };
    } catch (err) {
      return res.sendStatus(403);
    }
    next();
  } else {
    console.log("No Authorization header present");
    res.sendStatus(401);
  }
};

const verifyUserRole = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.auth.role;
    if (roleHasClearance(userRole, requiredRole)) {
      next();
    } else {
      res.sendStatus(403);
    }
  };
};

const allowManagerOrOrganizer = async (req, res, next) => {
  const userRole = req.auth?.role;
  if (userRole && roleHasClearance(userRole, RoleType.manager)) return next();
  const userId = req.userId;
  if (!userId) {
    return res.sendStatus(403);
  }

  const isOrganizer = await eventService.isEventOrganizer(req.params.eventId, userId);
  if (isOrganizer) return next();
  return res.sendStatus(403);
};

module.exports = { authenticateJWT, verifyUserRole, allowManagerOrOrganizer };
