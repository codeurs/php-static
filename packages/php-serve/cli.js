#!/usr/bin/env node

const yargs = require('yargs')
const phpServe = require('.')

const {port = 80, host = '127.0.0.1', _ = ['.']} = yargs
  .usage('Usage: $0 -p 80 -h 127.0.0.1 ./root')
  .alias('p', 'port')
  .alias('h', 'host')
  .argv

  phpServe(host, port, _[0] || '.')