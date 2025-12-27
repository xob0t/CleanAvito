import fs from 'fs';
import banner from 'rollup-plugin-banner2';
import replace from '@rollup/plugin-replace';

import { string } from './build/strings-plugin.mjs';
import userScriptMetadataBlock from './build/metadata.mjs';

const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const packageJson = loadJSON('./package.json');

const entry = 'src/index.js';

const config = [
  {
    input: entry,
    output: [
      {
        file: packageJson.main,
        format: 'iife',
      },
    ],
    plugins: [
      replace({
        preventAssignment: true,
        __VERSION__: JSON.stringify(packageJson.version),
        __HOMEPAGE__: JSON.stringify(packageJson.homepage)
      }),

      banner(userScriptMetadataBlock),

      // import css as string
      string({
        include: ['**/*.css'],
        transform(code) {
          return code
            .replace(/;\s*\n\s*/g, '; ')
            .replace(/\{\n */g, '{ ')
            .replace(/^\s*\n/gm, '')
            .replace(/;\s(\/\*.+\*\/)\n/g, '; $1 ')
            .trim();
        }
      }),
    ]
  },
];

export default config;
