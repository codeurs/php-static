const {spawn} = require('child_process')
const http = require('http')
const phpFpm = require('./fpm')
const serveStatic = require('serve-static')
const path = require('path')
const resolver = require('./resolver')
const cleanup = require('node-cleanup')

const FPM_PORT = 9050
const isWindows = process.platform === 'win32'
const cmd = isWindows ? 'php-cgi.cmd' : 'php-fpm'
const impl = isWindows ? 'php-static-window64' : 'php-static-linux64'
const fpmRoot = path.resolve(path.join(__dirname, '..', impl))
const ini = path.join(fpmRoot, 'php.ini')

module.exports = function(host, dir) {
  const params = host.split(':')
  const hostname = params.length > 1 ? params[0] : null
  const port = params.length > 1 ? params[1] : params[0]
  const root = dir ? path.resolve(dir) : process.cwd()
  const connection = isWindows
    ? {host: '127.0.0.1', port: FPM_PORT}
    : {sockFile: './php-fpm.sock'}

  const fpm = spawn(
    cmd,
    isWindows
      ? ['-b', `127.0.0.1:${FPM_PORT}`, '-c', ini]
      : ['-p', '.', '-F', '-y', path.join(fpmRoot, 'php-fpm.conf')],
    {stdio: 'inherit'}
  )

  cleanup(() => fpm.kill())

  const serve = serveStatic(root)
  const php = phpFpm({...connection, documentRoot: root}, resolver)

  const notFound = function(res, err) {
    if (err) console.error(err)
    res.writeHead(err ? 500 : 404)
    res.write(err ? `${err}` : 'Not found')
    res.end()
  }

  const handler = (req, res) => php(req, res, err => notFound(res, err))

  const server = http.createServer(function(req, res) {
    if (req.url.match(/\.php(\?.*)?$/)) handler(req, res)
    else serve(req, res, () => handler(req, res))
  })

  server.listen(port, hostname)
}
