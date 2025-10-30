const { RoleType } = require("@prisma/client");
const ROLES = [
  RoleType.regular,
  RoleType.cashier,
  RoleType.manager,
  RoleType.superuser,
]; // ranked by privilege

const roleHasClearance = (userRole, requiredRole) => {
  return ROLES.indexOf(userRole) >= ROLES.indexOf(requiredRole);
};

const USER_SCHEMA = {
  id: "number",
  utorid: "string",
  name: "string",
  email: "string",
}

module.exports = { ROLES, roleHasClearance };
