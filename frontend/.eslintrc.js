// https://docs.expo.dev/guides/using-eslint/
module.exports = {
    extends: [
        "expo",
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    plugins: ["prettier", "@typescript-eslint"],
    ignorePatterns: ["/dist/*"],
    rules: {
        "prettier/prettier": "warn",
    },
};
