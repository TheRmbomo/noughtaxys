var address = 'ws://192.168.1.223:3001'

WebSocket.prototype.emit = function (event, data, callback) {
  if (typeof event !== 'string') return
  else if (typeof data === 'function') {
    callback = data
    data = {}
  } else if (typeof callback !== 'function') callback = undefined

  var req = {event, data}, promise = Promise.resolve()
  if (callback) req.callback = true
  if (ws.readyState !== 1) promise = promise.then(() => new Promise(resolve => {
    let interval = setInterval(() => {
      if (ws.available) return resolve(clearInterval(interval))
    }, 50)
  }))
  promise.then(() => ws.send(JSON.stringify(req))).catch(e => console.log(e))
  if (!callback) return

  // Callback
  var callbackName = `callback-${event}`, callbackEvent = ws.events[callbackName],
  callbackFn = function() {callback(...arguments)}, popStack = event => ws.stacks[event].pop()
  if (!callbackEvent) {
    let stack = ws.stacks[callbackName] = []
    stack.unshift(callbackFn)
    ws.on(callbackName, res => popStack(callbackName)(res))
  }
  else {
    let stack = ws.stacks[callbackName]
    stack.unshift(callbackFn)
  }
};

WebSocket.prototype.on = function (setEvent, callback) {
  if (typeof setEvent !== 'string') throw new Error('Invalid event name')
  if (typeof callback !== 'function') throw new Error('Invalid callback function')
  if (!this.events) this.events = {}

  if (Object.keys(this.events).indexOf(setEvent) === -1) this.events[setEvent] = callback

  return this
}

var ws = Object.assign(new WebSocket(address), {events: {}, stacks: {}})

ws.onopen = function onopen() {
  ws.onmessage = eventObj => {
    if (eventObj.data === 'pong') return this.available = true
    try {
      var req = JSON.parse(eventObj.data), {data} = req, getEvent = req.event,
      res = (data.args) ? data.args : [data]
    } catch (e) {return}
    Object.keys(this.events).map(anEvent => {
      if (anEvent === getEvent) this.events[getEvent].apply(this, res)
    })
  }
  ws.onclose = () => {
    ws.available = false
    var interval = setInterval(() => {
      if (ws.readyState === 0) return
      if (ws.readyState === 1) return clearInterval(interval)

      let oldEvents = ws.events
      let oldStacks = ws.stacks
      ws = Object.assign(new WebSocket(address),{events: oldEvents, stacks: oldStacks, onopen})
    }, 50)
  }
  new Promise(resolve => {
    let interval = setInterval(() => {
      if (this.readyState !== 1) return
      if (this.available) return resolve(clearInterval(interval))
      ws.send('ping')
    }, 50)
  })
}
ws.onerror = function onerror(err) {}
