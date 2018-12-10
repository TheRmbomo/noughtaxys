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
  var textArea = document.createElement("textarea")
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    document.execCommand('copy')
    document.body.removeChild(textArea)
  } catch (err) {return Promise.reject(err)}
  return Promise.resolve()
}
function copyTextToClipboard(text) {
  if (!navigator.clipboard) return fallbackCopyTextToClipboard(text)
  else return navigator.clipboard.writeText(text).catch(e => null)
}
