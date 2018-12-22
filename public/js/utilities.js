function animate(render, jump = true) {
  var running = true, start = null, lastFrame = null
  return new Promise(resolve => {
    ;(function loop(now) {
      if (!start) start = now
      if (!lastFrame) lastFrame = now

      var deltaT = now - lastFrame, reduce = (!jump && deltaT > 1000)
      if (reduce) {
        start += deltaT
        deltaT = 0
      }
      var duration = now - start
      res = render(duration, deltaT)
      lastFrame = now
      if (res === true) {
        return requestAnimationFrame(loop)
      } else return resolve(res)
    })(start)
  })
}

function fallbackCopyTextToClipboard(text) {
  var textArea, created = false
  if (typeof text === 'string') {
    created = true
    textArea = document.createElement("textarea")
    .setStyle({
      fontSize: '16px'
      ,position: 'absolute'
    })
    textArea.value = text
    document.body.appendChild(textArea)
  } else {
    textArea = text
  }

  textArea.select()
  let range = document.createRange()
  range.selectNodeContents(textArea)
  let selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  textArea.setSelectionRange(0, 999999)

  try {
    document.execCommand('copy')
    if (created) document.body.removeChild(textArea)
  } catch (err) {
    console.log(err)
    return Promise.reject(err)
  }
  return Promise.resolve()
}
function copyTextToClipboard(text) {
  if (!navigator.clipboard) return fallbackCopyTextToClipboard(text)
  else return navigator.clipboard.writeText(text).catch(e => null)
}

function query(name) {
  return window.URLSearchParams ? new URLSearchParams(location.search).get(name)
  : (() => {
    var query = location.search.replace('?','').split('&')
    for (var i = query.length-1; i >= 0; i--) {
      query[i] = query[i].split('=')
      if (query[i][0] === name) return query[i][1]
    }
  })()
}

function eventListeners(element, events) {
  var unsetEvents = {}
  Object.keys(events).map(event => {
    var handler = events[event]
    if (typeof handler === 'function') element.addEventListener(event, handler)
    else if (Array.isArray(handler)) {
      options = handler[1]
      handler = handler[0]
      element.addEventListener(event, handler, options)
    }
    unsetEvents[event] = handler
  })
  return function () { Object.keys(unsetEvents).map(event => {
    var handler = unsetEvents[event]
    element.removeEventListener(event, handler)
  }) }
}

function httpRequest(method, url, onDone) {
  var req = new XMLHttpRequest()
  req.onreadystatechange = function() {if (this.readyState == 4 && this.status == 200) onDone()}
  req.open(method, url, true)
  req.send()
}
