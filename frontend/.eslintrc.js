// https://docs.expo.dev/guides/using-eslint/
module.exports = {
    extends: [
        "expo",
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    plugins: ["prettier", "@typescript-eslint", "react-hooks"],
    ignorePatterns: ["/dist/*"],
    rules: {
        "prettier/prettier": "warn",
        // Critical rules for preventing hooks errors
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",

        // Additional helpful rules
        "react/jsx-uses-react": "error",
        "react/jsx-uses-vars": "error",

        // React Native rules
        "react-native/no-raw-text": "warn",
        "react-native/no-single-element-style-arrays": "warn",
    },
};
