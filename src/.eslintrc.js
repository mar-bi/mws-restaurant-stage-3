module.exports = {
  "env": {
      "browser": true,
      "node": true,
      "es6": true,
      "serviceworker": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
      "ecmaVersion": 2015
  },
  "rules": {
      "indent": [
          "error",
          2
      ],
      "linebreak-style": [
          "error",
          "unix"
      ],
      "quotes": [
          "error",
          "single"
      ],
      "semi": [
          "error",
          "always"
      ],
      "no-console": "off"
  }
};