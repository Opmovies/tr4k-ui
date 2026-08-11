#!/usr/bin/env node
// Emballe un dossier de plugin en zip installable sur /plugins.
// Usage : npm run plugin:pack -- ../plugins-src/seedbox-qbit
import { zipSync } from 'fflate'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative, basename } from 'node:path'

const dir = resolve(process.cwd(), process.argv[2] || '')
if (!process.argv[2]) {
  console.error('Usage : node scripts/pack-plugin.mjs <dossier-du-plugin>')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8'))
const files = {}
;(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.name === '.DS_Store' || e.name === 'node_modules' || e.name === '.git' || e.name === '.gitignore') continue
    if (e.isDirectory()) walk(p)
    else files[relative(dir, p).split('\\').join('/')] = readFileSync(p)
  }
})(dir)

const out = resolve(dir, '..', `${manifest.id}-${manifest.version}.zip`)
writeFileSync(out, zipSync(files, { level: 6 }))
console.log(`✓ ${basename(out)} (${Object.keys(files).length} fichiers, ${(statSync(out).size / 1024).toFixed(1)} Ko)`)
console.log(`  → ${out}`)
