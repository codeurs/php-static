const path = require('path')
const fs = require('fs')

const fileExists = file =>
  new Promise(done => fs.access(file, err => done(!err)))

const fileExistsInRoot = (root, file) => {
  const resolved = path.resolve(path.join(root, file))
  if (!resolved.startsWith(root)) return Promise.resolve(false)
  return fileExists(resolved)
}

module.exports = async function(root, url) {
  if (typeof url !== 'string' || !url.startsWith('/')) throw 'Invalid URL'

  const dir = path.resolve(root)
  const pathname = url.split('?')[0]
  const dirs = pathname.split('/')
  const found = fileExistsInRoot.bind(null, dir)

  if (pathname.substr(-4).toLowerCase() === '.php')
    if (await found(pathname)) return pathname

  do {
    const index = path.join(...dirs.concat('index.php'))
    if (await found(index)) return index
    dirs.pop()
  } while (dirs.length)

  throw 'Not found'
}
