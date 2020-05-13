module.exports = {
    env: {
        browser: true,
        amd: true,
        node: true
    },
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
    },
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'standard-with-typescript',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
    ],
    rules: {
        "@typescript-eslint/indent": ["error", 4]
    }
};