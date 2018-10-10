#!/usr/bin/env node

const phpStatic = require('.')
const args = process.argv
const [host, dir] = args.slice(2)

phpStatic(host, dir)