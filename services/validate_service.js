const {
  stringLengthValid,
  MAX_NAME_LEN,
  EMAIL_FINISH,
  generalEmailRegex,
} = require("../utils");
const { ROLES } = require("../constants");

const validateService = {
  validateEmail: (email) => {
    if (typeof email !== "string") {
      return { valid: false, message: "Invalid email" };
    }
    email = email.trim().toLowerCase();
    if (
      !email ||
      !email.endsWith(EMAIL_FINISH) ||
      !generalEmailRegex.test(email)
    ) {
      return { valid: false, message: "Invalid email" };
    }
    return { valid: true, email };
  },
  validateName: (name) => {
    if (typeof name !== "string") {
      return { valid: false, message: "Invalid name" };
    }
    name = name.trim();
    if (!name || !stringLengthValid(name, 1, MAX_NAME_LEN)) {
      return { valid: false, message: "Invalid name" };
    }
    return { valid: true, name };
  },
  validateUtorid: (utorid) => {
    if (typeof utorid !== "string") {
      return { valid: false, message: "Invalid utorid" };
    }
    utorid = utorid.trim();
    if (!utorid || !stringLengthValid(utorid, 7, 8)) {
      return { valid: false, message: "Invalid utorid" };
    }
    return { valid: true, utorid };
  },

  validateBirthday: (birthday) => {
    if (typeof birthday !== "string") {
      return { valid: false, message: "Invalid birthday" };
    }
    birthday = birthday.trim();
    // Check for YYYY-MM-DD format
    const birthRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthday || !birthRegex.test(birthday)) {
      return {
        valid: false,
        message: "Invalid birthday format. Use YYYY-MM-DD.",
      };
    }

    const date = new Date(birthday + "T00:00:00"); // add time to avoid timezone issues
    if (isNaN(date.getTime())) {
      return { valid: false, message: "Invalid date" };
    }

    const [year, month, day] = birthday.split("-").map(Number);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return { valid: false, message: "Invalid date" };
    }

    return { valid: true, birthday };
  },
  validateRole: (role) => {
    if (typeof role !== "string") {
      return { valid: false, message: "Invalid role" };
    }
    role = role.trim();
    if (!ROLES.includes(role)) {
      return { valid: false, message: "Invalid role" };
    }
    return { valid: true, role };
  },
  validateVerified: (verified) => {
    if (typeof verified !== "boolean") {
      return { valid: false, message: "Invalid verified" };
    }
    return { valid: true, verified };
  },
  validateSuspicious: (suspicious) => {
    if (typeof suspicious !== "boolean") {
      return { valid: false, message: "Invalid suspicious" };
    }
    return { valid: true, suspicious };
  },
  validatePassword: (password) => {
    if (typeof password !== "string") {
      return { valid: false, message: "Invalid password" };
    }
    password = password.trim();
    if (!stringLengthValid(password, 8, 20)) {
      return { valid: false, message: "Invalid password length" };
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return {
        valid: false,
        message:
          "Invalid password. Password must contain uppercase, lowercase, number, and special character.",
      };
    }
    return { valid: true, password };
  },

  validateObjHasCorrectKeys: (obj, requiredKeys) => {
    for (const key of Object.keys(obj)) {
      if (!requiredKeys.includes(key)) {
        return { valid: false, message: `Invalid field: ${key}` };
      }
    }
    return { valid: true, obj };
  },

  validateObjHasCorrectKeysAndType: (obj, requiredKeys) => {
    for (const key of Object.keys(obj)) {
      if (!requiredKeys.hasOwnProperty(key) || typeof obj[key] !== requiredKeys[key]) {
        return { valid: false, message: `Invalid field: ${key}` };
      }
    }
    return { valid: true, obj };
  },
  
  validateObjHasRequiredKeys: (obj, requiredKeys) => {
    for (const key of requiredKeys) {
      if (!obj.hasOwnProperty(key)) {
        return { valid: false, message: `Missing required field: ${key}` };
      }
    }
    return { valid: true, obj };
  },
};

module.exports = { validateService };
