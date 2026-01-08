#!/usr/bin/env node
// Script to generate version.ts from package.json version
const fs = require('fs');
const path = require('path');
const pkg = require(path.join(__dirname, '..', 'package.json'));

const content = `// Auto-generated version file
// This file is generated during build to avoid runtime file reading issues
export const VERSION = '${pkg.version}';
`;

const targetPath = path.join(__dirname, '..', 'src', 'version.ts');
fs.writeFileSync(targetPath, content);
console.log(`Generated src/version.ts with version ${pkg.version}`);
