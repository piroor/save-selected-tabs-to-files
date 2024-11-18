import globals from "globals";
import _import from "eslint-plugin-import";

export default [{
    ignores: ["eslint.config.mjs", "extlib/*", "submodules/*", "!**/.eslintrc.js"],
}, {
    plugins: {
        import: _import,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.webextensions,
        },

        ecmaVersion: 2022,
        sourceType: "module",
    },

    settings: {
        "import/resolver": {
            "babel-module": {
                root: ["./"],
            },
        },
    },

    rules: {
        indent: ["warn", 2, {
            SwitchCase: 1,
            MemberExpression: 1,

            CallExpression: {
                arguments: "first",
            },

            VariableDeclarator: {
                var: 2,
                let: 2,
                const: 3,
            },
        }],

        quotes: ["warn", "single", {
            avoidEscape: true,
            allowTemplateLiterals: true,
        }],


        "no-const-assign": "error",

        "prefer-const": ["warn", {
            destructuring: "any",
            ignoreReadBeforeAssign: false,
        }],

        "no-var": "error",

        "no-unused-vars": ["warn", {
            vars: "all",
            args: "after-used",
            argsIgnorePattern: "^_",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
        }],

        "no-use-before-define": ["error", {
            functions: false,
            classes: true,
        }],

        "no-unused-expressions": "error",
        "no-unused-labels": "error",

        "no-undef": ["error", {
            typeof: true,
        }],

        "import/default": "error",
        "import/namespace": "error",
        "import/no-duplicates": "error",
        "import/export": "error",
        "import/extensions": ["error", "always"],
        "import/first": "error",
        "import/named": "error",
        "import/no-named-as-default": "error",
        "import/no-named-as-default-member": "error",
        "import/no-cycle": ["warn", {}],
        "import/no-self-import": "error",

        "import/no-unresolved": ["error", {
            caseSensitive: true,
        }],

        "import/no-useless-path-segments": "error",
    },
}];