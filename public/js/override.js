Node.prototype.addChildren = function(...args) {
  for (var i = 0; i < args.length; i++) {
    if (i > 0 && typeof args[i] === 'string') this[args[i]] = args[i-1]
    else this.appendChild(args[i])
  }
  return this
}

Node.prototype.makeChildOf = function(parent, name) {
  parent.appendChild(this)
  if (name) parent[name] = this
  return this
}
Node.prototype.makeKeyOf = function(parent, name) {
  if (name) parent[name] = this
  return this
}

Element.prototype._setAttribute = Element.prototype.setAttribute
Object.assign(Element.prototype, {
  setAttribute: function(key, value) {
    this._setAttribute(key, value)
    return this
  }
  ,setAttributes: function(...pairs) {
    for (var i = 0; i < pairs.length; i+=2) {this._setAttribute(pairs[i], pairs[i+1])}
    return this
  }
  ,addClasses: function(...classes) {
    this.classList.add(...classes)
    return this
  }
})

HTMLElement.prototype.setStyle = function(obj) {
  Object.assign(this.style, obj)
  return this
}

THREE.EffectComposer.prototype.addPasses = function(...args) {
  for (var i = 0; i < args.length; i++) {this.addPass(args[i])}
  return this
}
