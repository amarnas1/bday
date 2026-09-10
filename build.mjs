import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all([
    cp('index.html', 'dist/index.html'),
    cp('style.css', 'dist/style.css'),
    cp('script.js', 'dist/script.js'),
    cp('assets', 'dist/assets', { recursive: true }),
]);
