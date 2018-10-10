// Based on https://github.com/ivanslf/node-php-fpm/blob/9fbfdc491b56c4d5c49f48327a4009f46238d95d/index.js

const path = require('path')
const fastCgi = require('fastcgi-client')
const HTTPParser = require('http-parser-js').HTTPParser

const cleanObj = obj => {
  const res = {}
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] !== 'undefined') res[key] = obj[key]
  })
  return res
}

const formatHeader = header =>
  header
    .toUpperCase()
    .split('-')
    .join('_')

const getHeaders = (req, root, location) => {
  const script = path.posix.join(root, location)
  const headers = {}
  for (const header in req.headers)
    headers['HTTP_' + formatHeader(header)] = req.headers[header]
  const document = req.url.split('?')[0]
  const scriptName = script.substr(path.posix.resolve(root).length)
  return cleanObj({
    REQUEST_METHOD: req.method,
    CONTENT_TYPE: req.headers['content-type'],
    CONTENT_LENGTH: req.headers['content-length'],
    CONTENT_DISPOSITION: req.headers['content-disposition'],
    DOCUMENT_ROOT: root,
    SCRIPT_FILENAME: script,
    SCRIPT_NAME: scriptName,
    REQUEST_URI: req.url,
    DOCUMENT_URI: document,
    QUERY_STRING: req.url.substr(document.length + 1),
    REQUEST_SCHEME: req.protocol,
    HTTPS: req.protocol === 'https' ? 'on' : undefined,
    REMOTE_ADDR: req.connection.remoteAddress,
    REMOTE_PORT: req.connection.remotePort,
    SERVER_NAME: req.connection.domain,
    SERVER_PROTOCOL: 'HTTP/1.1',
    GATEWAY_INTERFACE: 'CGI/1.1',
    SERVER_SOFTWARE: 'php-fpm for Node',
    REDIRECT_STATUS: 200,
    ...headers
  })
}

module.exports = function(options, resolver) {
  const fpm = new Promise((resolve, reject) => {
    const loader = fastCgi({
      ...options,
      skipCheckServer: true
    })
    loader.on('ready', () => resolve(loader))
    loader.on('error', reject)
  })

  return function(req, res, next) {
    return Promise.all([resolver(options.documentRoot, req.url), fpm])
      .then(
        ([script, php]) =>
          new Promise(function(resolve, reject) {
            const headers = getHeaders(req, options.documentRoot, script)
            php.request(headers, function(err, request) {
              if (err) return reject(err)
              const errors = []
              const parser = new HTTPParser(HTTPParser.RESPONSE)
              const parse = data => parser.execute(data)
              const headerValue = (name, value) => {
                const exists = res.getHeader(name)
                return exists ? [].concat(exists).concat(value) : value
              }
              const setHeader = (name, value) => {
                if (name == 'Status')
                  res.statusCode = parseInt(value.split(' ')[0], 10)
                else res.setHeader(name, headerValue(name, value))
              }
              const writeHead = ({headers}) => {
                while (headers.length)
                  setHeader(headers.shift(), headers.shift())
              }
              const writeBody = (chunk, offset, length) =>
                res.write(chunk.slice(offset, offset + length))
              const getErrors = () =>
                new Error(Buffer.concat(errors).toString('utf8'))
              const finish = () => {
                if (errors.length) reject(getErrors())
                else resolve(res.end())
              }

              parser.state = 'HEADER'
              parser[HTTPParser.kOnHeadersComplete] = writeHead
              parser[HTTPParser.kOnBody] = writeBody
              request.stderr.on('data', errors.push)
              request.stdout.on('data', parse)
              request.stdout.on('end', finish)
              req.pipe(request.stdin)
            })
          })
      )
      .catch(next)
  }
}
