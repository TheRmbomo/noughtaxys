const WebSocket = require('ws')
const cookie = require('cookie')
const jwt = require('jsonwebtoken')

const {httpServer} = require('./app')

var ws = new WebSocket.Server({server: httpServer})

ws.on('connection', (socket, req) => {
  socket.events = {}
  socket._on = socket.on
  socket._send = socket.send
  socket.send = function (event, data) {
    if (typeof event !== 'string') return

    var req = {event}
    if (data) req.data = data
    req = JSON.stringify(req)

    if (this.readyState === 1) this._send(req)
    else console.log('WS wasn\'t ready')
  }

  socket._on('message', req => {
    try {
      if (req === 'ping') return socket._send('pong')
      req = JSON.parse(req)
    } catch (e) {return}
    var promise = Promise.resolve()
    if (!socket.events[req.event]) {
      promise = promise.then(() => new Promise((resolve, reject) => setTimeout(() => {
        if (!socket.events[req.event]) return reject()
        else return resolve()
      }, 1000)))
    }

    promise = promise.then(() => {
      var done = false,
      callback = (req.callback !== undefined) ? (function () {
        if (done) return console.error('Callback already sent')
        var args = Array.from(arguments)
        socket.send(`callback-${req.event}`, {event: req.event, args})
        done = true
      }) : () => {}
      socket.events[req.event](req.data, callback)
    }).catch(e => e)
  })

  socket.on = function (event, callback) {
    if (typeof event !== 'string' || typeof callback !== 'function') return
    if (socket.events[event]) return console.log(`Event already defined: ${event}`)
    socket.events[event] = callback
  }

  var promise = Promise.resolve()
  if (req.headers.cookie) {
    socket.cookies = cookie.parse(req.headers.cookie)
    let token = socket.cookies[process.env.COOKIE_NAME]
    promise = promise.then(() => new Promise((resolve, reject) => {
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
