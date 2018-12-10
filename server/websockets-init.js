const WebSocket = require('ws')
const cookie = require('cookie')
const jwt = require('jsonwebtoken')

const {httpServer} = require('./app')
const Game = require('./db/models/game')

var ws = new WebSocket.Server({server: httpServer})

ws.on('connection', (socket, req) => {
  socket._send = socket.send
  socket.send = function (event, data) {
    if (typeof event !== 'string') return

    var req = {event}
    if (data) req.data = data
    req = JSON.stringify(req)

    if (this.readyState === 1) this._send(req)
  }

  socket.on('message', req => {
    try {
      if (req === 'ping') return socket._send('pong')
      req = JSON.parse(req)
    } catch (e) {return}

    var done = false, callback = (req.callback !== undefined) ? (function (...args) {
      if (done) return console.error('Callback already sent')
      socket.send(`callback-${req.event}`, {event: req.event, args})
      done = true
    }) : () => {}

    socket.emit(req.event, req.data, callback)
  })

  var promise = Promise.resolve()
  if (req.headers.cookie) {
    socket.cookies = cookie.parse(req.headers.cookie)
    let token = socket.cookies[process.env.COOKIE_NAME]
    promise = promise.then(() => new Promise((resolve, reject) => {
      if (!token) reject()
      jwt.verify(token, process.env.JWT_SECRET, (err, res) => {
        if (err) return reject(err)
        if (res) {
          delete res.iat; delete res.exp
          resolve(socket.token = res)
        }
        else return resolve(socket.token = null)
      })
    }))
  }
  promise = promise.catch(e => e).then(() => ws.emit('ready', socket, req))
})

module.exports = ws
