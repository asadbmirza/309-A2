const EMAIL_FINISH = "utoronto.ca";
const MAX_NAME_LEN = 50;
const generalEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stringLengthValid = (str, min, max) => {
  return typeof str === "string" && str.length >= min && str.length <= max;
};

module.exports = {
    EMAIL_FINISH,
    MAX_NAME_LEN,
    generalEmailRegex,
    stringLengthValid
};