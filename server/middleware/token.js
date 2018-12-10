const cookie = require('cookie')
const jwt = require('jsonwebtoken')
const uuid = require('uuid/v4')

var cookieOpts = {
  maxAge: 1000 * 60 * 60 * 24 * 7, secure: process.env.COOKIE_SECURE === 'true',
  httpOnly: true
}

module.exports.set = (token, data) => {
  if (!(token && data)) throw '2 parameters required'

  // Edits token
  var payload = Object.assign({}, token, data), jwtOpts = {expiresIn: cookieOpts.maxAge + 'ms'}
  Object.keys(payload).map(key => {if (payload[key] === 'delete') delete payload[key]})

  return new Promise((resolve, reject) => {
    return jwt.sign(payload, process.env.JWT_SECRET, jwtOpts, (err, token) => {
      if (err) return reject(err)
      else return resolve(token)
    })
  })
}

module.exports.get = (req, res, next) => {
  function createNewToken() {
    var payload = {id: uuid()}
    return module.exports.set(payload, {}).then(newToken => {
      res.cookie(process.env.COOKIE_NAME, newToken, cookieOpts)
      req.token = payload
      return next()
    })
  }
  try {
    var token = cookie.parse(req.headers.cookie)[process.env.COOKIE_NAME]
    if (!token) throw ''
    return jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
      if (err) throw err
      if (payload) {
        delete payload.iat; delete payload.exp
        req.token = payload
        return next()
      } else return createNewToken()
    })
  } catch (e) {return createNewToken()}
}

module.exports.cookie = cookieOpts
