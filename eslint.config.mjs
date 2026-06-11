import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'Content/JavaScript/**',
            'Typing/**',
            'node_modules/**',
            'Plugins/**',
            'TypeScript/Mixins/_generated/**',
            'TypeScript/Blueprints/_generated/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['TypeScript/**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            'no-console': 'error',
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.property.name='Load'][callee.object.property.name='Class'][callee.object.object.name='UE'] > Literal[value=/^\\/Game\\//]",
                    message:
                        "Do not hardcode UE.Class.Load('/Game/...'); use BlueprintCatalog APIs (loadBlueprintClass / registerBlueprintMixin).",
                },
                {
                    selector:
                        "MemberExpression[object.object.object.name='UE'][object.object.property.name='Game'][object.property.name='Blueprints']",
                    message:
                        'Do not reference UE.Game.Blueprints directly; use BlueprintInstance<typeof XxxBlueprint> from TypeScript/Blueprints.',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            // UE 生命周期回调常保留完整签名 (如 EndPlayReason), 不在编辑器里提示未使用参数.
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',
        },
    },
    {
        files: ['TypeScript/Global/Logger.ts'],
        rules: {
            'no-console': 'off',
        },
    }
);
