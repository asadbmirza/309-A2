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

module.exports = { ROLES, roleHasClearance };
