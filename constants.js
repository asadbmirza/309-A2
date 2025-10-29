const ROLES = ["regular", "cashier", "manager", "superuser"]; // ranked by privilege
const ROLE_ENUM = {
  regular: "regular",
  cashier: "cashier",
  manager: "manager",
  superuser: "superuser",
};

function roleHasClearance(userRole, requiredRole) {
  return ROLES.indexOf(userRole) >= ROLES.indexOf(requiredRole);
}

module.exports = { ROLES, ROLE_ENUM, roleHasClearance };