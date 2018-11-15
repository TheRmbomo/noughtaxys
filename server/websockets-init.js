const WebSocket = require('ws')
const cookie = require('cookie')

const {httpServer} = require('./app')
const {redisClient} = require('./middleware/session')

var ws = new WebSocket.Server({server: httpServer})

ws.on('connection', (socket, req) => {
  socket.events = {}
  socket._on = socket.on
  socket._send = socket.send
  socket.send = function (event, data) {
    if (typeof event !== 'string') return

    var req = {event}
    if (data) req.data = data

    if (this.readyState === 1) this._send(JSON.stringify(req))
  }

  socket._on('message', req => {
    try {
      if (req === 'ping') return socket._send(`pong`)
      req = JSON.parse(req)
    } catch (e) {return}
    var promise = Promise.resolve()
    if (!socket.events[req.event]) {
      promise = promise.then(() => new Promise((resolve, reject) => setTimeout(() => {
        if (!socket.events[req.event]) {
          socket.send(`callback-${req.event}`,
            {event: req.event, data: 'Invalid event.'}
          )
          return reject()
        }
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
      socket.session.save().catch(e => e)
    }, e => e)
    .catch(e => e)
  })

  socket.on = function (event, callback) {
    if (typeof event !== 'string' || typeof callback !== 'function') return
    if (socket.events[event]) return console.log(`Event already defined: ${event}`)
    socket.events[event] = callback
  }

  try {
    socket.cookies = cookie.parse(req.headers.cookie)
    socket.sessionID = socket.cookies[process.env.COOKIE_NAME + '.sid'].slice(2).split('.')[0]
  } catch (e) {}
  socket.session = null

  var promise = Promise.resolve()
  if (socket.sessionID) {
    promise = promise.then(() => {
      return new Promise((resolve, reject) => {
        redisClient.get(socket.sessionID, (err, session) => {
          if (err) return reject(err)
          if (session) resolve(session)
          else reject('No session')
        })
      })
      .then(session => {
        session.save = () => new Promise((resolve, reject) => {
          redisClient.set(socket.sessionID, session, err => {
            if (err) reject(err)
            resolve()
          })
        })
        socket.session = session
      })
    })
  }
  promise.then(() => ws.emit('ready', socket, req)).catch(console.log)
})

module.exports = ws
