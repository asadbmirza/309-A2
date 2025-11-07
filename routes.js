const express = require("express");
const userController = require("./controllers/user");
const authController = require("./controllers/auth");
const eventsController = require("./controllers/events");
const promotionsController = require("./controllers/promotions");
const userRouter = express.Router();
const authRouter = express.Router();
const eventsRouter = express.Router();
const promotionsRouter = express.Router();
const { verifyUserRole, allowManagerOrOrganizer } = require("./middleware/auth");
const { RoleType } = require("@prisma/client");
const { upload } = require("./middleware/upload");
const events = require("./services/events");
const promotions = require("./services/promotions");

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
userRouter.get(
  "/me",
  verifyUserRole(RoleType.regular),
  userController.getPersonalProfile
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


// events routes
eventsRouter.post("/", verifyUserRole(RoleType.manager), eventsController.createEvent); 
eventsRouter.get("/", eventsController.getEvents);

eventsRouter.get("/:eventId", eventsController.getEvent);
eventsRouter.patch("/:eventId", allowManagerOrOrganizer, eventsController.updateEvent);
eventsRouter.delete("/:eventId", verifyUserRole(RoleType.manager), eventsController.deleteEvent);

eventsRouter.post("/:eventId/organizers", verifyUserRole(RoleType.manager), eventsController.addOrganizer);
eventsRouter.delete("/:eventId/organizers/:userId", verifyUserRole(RoleType.manager), eventsController.removeOrganizer);

eventsRouter.post("/:eventId/guests", allowManagerOrOrganizer, eventsController.addGuest);

eventsRouter.post("/:eventId/guests/me", eventsController.rsvpToEvent);
eventsRouter.delete("/:eventId/guests/me", eventsController.removeRsvp);

eventsRouter.delete("/:eventId/guests/:userId", verifyUserRole(RoleType.manager), eventsController.removeGuest);

eventsRouter.post("/:eventId/transactions", allowManagerOrOrganizer, eventsController.awardPoints);

eventsRouter.all("/", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/organizers", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/organizers/:userId", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/guests", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/guests/:userId", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/guests/me", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
eventsRouter.all("/:eventId/transactions", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});


// promotions routes
promotionsRouter.post("/", verifyUserRole(RoleType.manager), promotionsController.createPromotion);
promotionsRouter.get("/", promotionsController.getPromotions);

promotionsRouter.get("/:promotionId", promotionsController.getPromotion);
promotionsRouter.patch("/:promotionId", verifyUserRole(RoleType.manager), promotionsController.updatePromotion);
promotionsRouter.delete("/:promotionId", verifyUserRole(RoleType.manager), promotionsController.deletePromotion);

promotionsRouter.all("/", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});
promotionsRouter.all("/:promotionId", (req, res) => {
  res.status(405).json({ message: "Method Not Allowed" });
});

module.exports = { userRouter, authRouter, eventsRouter, promotionsRouter };
