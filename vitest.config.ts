import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    test: {
        include: ['Tests/**/*.spec.ts'],
        globals: false,
    },
    resolve: {
        alias: {
            ue: fromRoot('./Tests/mocks/ue.ts'),
            puerts: fromRoot('./Tests/mocks/puerts.ts'),
        },
    },
});
