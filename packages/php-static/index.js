const {spawn} = require('child_process')
const cleanup = require('node-cleanup')
const http = require('http')
const phpFpm = require('./fpm')
const serveStatic = require('serve-static')
const path = require('path')

const FPM_PORT = 9050

module.exports = function(port = 80, dir) {
  const root = dir ? path.resolve(dir) : process.cwd()
  const isWindows = process.platform === 'win32'
  const cmd = isWindows ? 'php-fpm.cmd' : 'php-fpm'

  const fpm = spawn(
    cmd,
    isWindows
      ? ['-b', `127.0.0.1:${FPM_PORT}`, /*'-c', 'C:/tools/php/php.ini'*/]
      : ['-p', '.', '-F']
  )

  cleanup((exitCode, signal) => {
    fpm.kill()
  })

  fpm.stdout.on('data', data => {
    console.log(`stdout: ${data}`)
  })

  fpm.stderr.on('data', data => {
    console.log(`stderr: ${data}`)
  })

  fpm.on('close', code => {
    console.log(`child process exited with code ${code}`)
  })

  const serve = serveStatic(root)
  const php = phpFpm({
    host: '127.0.0.1',
    port: FPM_PORT,
    documentRoot: root
  })

  const notFound = function(res) {
    res.writeHead(404)
    res.write('Not found')
    res.end()
  }

  const server = http.createServer(function(req, res) {
    if (req.url.match(/\.php(\?.*)?$/)) php(req, res)
    else serve(req, res, () => notFound(res))
  })

  server.listen(port)
}
