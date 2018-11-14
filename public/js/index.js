let main = {
  mouseRaycaster: new THREE.Raycaster(), boardRaycaster: new THREE.Raycaster()
  ,gltfLoader: new THREE.GLTFLoader()
  ,objects: []
  ,boardPosition: (unit => [
    [-unit,-unit], [0,-unit], [unit,-unit],
    [-unit,    0], [0,    0], [unit,    0],
    [-unit, unit], [0, unit], [unit, unit]
  ])(100*1.05)
  ,sizing: {
    resize: function() {
      main.sizing.array.map(e => {
      main.canvas.style.width = '0px'
      main.canvas.style.height = '0px'
      e.size = {x: window.innerWidth, y: window.innerHeight}
    })}
    ,push: function(...e) {main.sizing.array.push(...e); this.resize()}
    ,remove: function(...e) {e.map(e => main.sizing.array.splice(
      main.sizing.array.indexOf(e),1
    ))}
    ,array: []
  }
}

window.addEventListener('scroll', event => {
  event.preventDefault()
  document.body.scrollTop = 0
  window.scrollY = 0
}, {passive: false})
window.addEventListener('contextmenu', event => event.preventDefault())
window.addEventListener('resize', main.sizing.resize)
document.body.addEventListener('touchstart', event => {
  if (event.target === document.body) return event.preventDefault()
  if (event.target === main.canvas) return event.preventDefault()
}, {passive: false})

function wsLog() {
  console._log = console.log
  console._error = console.error
  console.log = (...a) => {
    ws.emit('log', a)
    console._log(...a)
  }
  console.error = (...a) => {
    ws.emit('log', a)
    console._error(...a)
  }
}

function createMesh(geometry, opt) {
  opt = Object.assign({
    color: 0xffffff, opacity: 1, transparent: false
  }, opt)
  if (opt.opacity !== 1) opt.transparent = true
  var material = new THREE.MeshBasicMaterial({
    color: opt.color, opacity: opt.opacity, transparent: opt.transparent
  })
  ,mesh = new THREE.Mesh(geometry, material)
  if (opt.t) mesh.position.set(...opt.t)
  if (opt.parent) opt.parent.add(mesh)
  return mesh
}

function createSquare(opt) {
  opt = Object.assign({s: [1,1]}, opt)
  opt.s[0] /= 2
  opt.s[1] /= 2
  var geometry = new THREE.Geometry(), normal = new THREE.Vector3(0,1,0)
  geometry.vertices.push(new THREE.Vector3(-opt.s[0],0,-opt.s[1]))
  geometry.vertices.push(new THREE.Vector3( opt.s[0],0,-opt.s[1]))
  geometry.vertices.push(new THREE.Vector3(-opt.s[0],0, opt.s[1]))
  geometry.vertices.push(new THREE.Vector3( opt.s[0],0, opt.s[1]))
  geometry.faces.push(new THREE.Face3(2,1,0))
  geometry.faces.push(new THREE.Face3(3,1,2))
  return createMesh(geometry, opt)
}

function createBox(opt) {
  opt = Object.assign({s: [1,1,1]}, opt)
  var geometry = new THREE.BoxBufferGeometry(opt.s[0], opt.s[1], opt.s[2])
  return createMesh(geometry, opt)
}

function hudInit() {
  var hud = main.hud = {
    wrapper: document.createElement('div'), body: document.createElement('div')
  }
  hud.wrapper.appendChild(hud.body)
  hud.wrapper.classList.add('hud')
  hud.wrapper.style.overflow = 'auto'

  function createText(tag, text, parent) {
    var node = document.createElement(tag), textNode = document.createTextNode(text)
    node.classList.add('noselect')
    node.appendChild(textNode)
    if (parent) parent.appendChild(node)
    return node
  }

  var playerList = main.playerList = {
    label: createText('div', 'Player List')
    ,body: document.createElement('table')
    ,header: document.createElement('tr')
  }
  playerList.label.classList.add('hudlabel')
  hud.body.appendChild(playerList.label)
  hud.body.appendChild(document.createElement('hr'))
  createText('td', 'Name', playerList.header)
  createText('td', 'Wins', playerList.header)
  createText('td', 'Piece', playerList.header)
  playerList.body.appendChild(playerList.header)
  main.info.then(info => {
    info.players.map(player => {
      var playerListing = document.createElement('tr')
      createText('td', player.name, playerListing)
      createText('td', player.wins, playerListing)
      createText('td', player.piece, playerListing)
      playerList.body.appendChild(playerListing)
    })
  })
  hud.body.appendChild(playerList.body)
  hud.body.appendChild(document.createElement('hr'))

  var infobox = {
    body: document.createElement('div')
    ,games: createText('div', 'Games: '), draws: createText('div', 'Draws: ')
  }
  infobox.body.appendChild(infobox.games)
  infobox.body.appendChild(infobox.draws)
  main.info.then(info => {
    infobox.games.appendChild(document.createTextNode(info.games))
    infobox.draws.appendChild(document.createTextNode(info.draws))
  })
  hud.body.appendChild(infobox.body)

  var bottombox = {
    body: document.createElement('div')
    ,viewers: createText('div', 'Viewers: ')
    ,chat: createText('button', 'Chat'), settings: createText('button', 'Settings')
  }
  bottombox.body.style.position = 'relative'
  bottombox.body.style.paddingTop = '20px'
  bottombox.body.style.width = '100%'
  bottombox.body.style.textAlign = 'left'
  bottombox.body.style.bottom = 0
  bottombox.viewers.style.textAlign = 'right'
  bottombox.viewers.style.marginRight = '10px'
  bottombox.chat.type = 'button'
  bottombox.settings.style.float = 'right'
  bottombox.settings.type = 'button'
  bottombox.body.appendChild(bottombox.viewers)
  bottombox.body.appendChild(document.createElement('hr'))
  bottombox.body.appendChild(bottombox.chat)
  bottombox.body.appendChild(bottombox.settings)
  main.info.then(info => {
    bottombox.viewers.appendChild(document.createTextNode(info.viewers.length))
  })
  hud.body.appendChild(bottombox.body)

  main.sizing.push({set size(v) {
    var w = 200, h = v.y, x = v.x - w
    main.info.then(info => {
      hud.wrapper.style.height = 'auto'
      var compHeight = parseFloat(getComputedStyle(hud.wrapper).height)
      if (compHeight) h = Math.min(compHeight, v.y)
      hud.wrapper.style.height = h+1 + 'px'
    })
    Object.assign(hud.wrapper.style, {
      width: w + 'px'
    })
  }})
  document.body.appendChild(hud.wrapper)
}

function updateBoard() {
  var {game} = main
  main.info.then(info => {
    for (let boardI = 0; boardI < 9; boardI++) {
      let board = {c:game.pieces[0][boardI], s:info.game[boardI]}, pieces = info.pieces.length
      if (board.c.won) continue

      if (board.s.winner && board.s.winner < pieces) {
        let cellI = main.objects.indexOf(board.c.children[0])
        if (cellI !== -1) main.objects.splice(cellI,9)
        let model = main.models[board.s.winner].clone()
        model.position.set(...(x => [x[0],10,x[1]])(main.boardPosition[boardI]))
        model.visible = true
        game.pieces[board.s.winner][boardI] = model
        game.add(model)
        for (let winI = 0; winI < board.s.win.length; winI++) {
          let cellI = board.s.win[winI], cellMat = board.c.cells[cellI].material
          cellMat.color = [1,0,0]
          cellMat.transparency = false
          cellMat.opacity = 1
        }
      }

      for (let pieceI = 0; pieceI < 9; pieceI++) {
        let piece = board.s.board[pieceI]
        if (!piece || piece >= pieces) continue
        let cellI = main.objects.indexOf(board.c.children[pieceI])
        if (cellI !== -1) main.objects.splice(cellI,1)
        let model = main.models[piece].clone()
        model.position.set(...(x => [x[0],0.5,x[1]])(main.boardPosition[pieceI]))
        model.visible = true
        board.c.pieces[piece][pieceI] = model
        board.c.add(model)
      }
    }
  })
}

function boardInit() {
  var {scene, camera, gltfLoader} = main, boardPos = main.boardPosition
  ,loadMesh = file => new Promise((resolve, reject) => {
    gltfLoader.load(file, obj => resolve(obj.scene.children[0]), null, reject)
  })
  ,sidelength = 320
  ,game = main.game = createBox({s: [sidelength, 20, sidelength], color: 0xdddddd})
  game.name = 'main_board'
  game.pieces = []
  game.sidelength = sidelength
  scene.add(game)

  main.info.then(info => {
    info.pieces[0] = 'board'
    var models = info.pieces.map(name => loadMesh(name + '.gltf').catch(e => null))
    Promise.all(models).then(data => {
      for (let pieceI = 0; pieceI < data.length; pieceI++) {
        data[pieceI].name = info.pieces[pieceI]
        game.pieces.push([null,null,null,null,null,null,null,null,null])
      }

      var [board] = data, cell = createSquare({s: [100,100], opacity: 0, t: [0,20,0]})
      data[0] = null
      main.models = data
      cell.name = 'cell'

      board.scale.x = board.scale.z = 3/10

      for (let spotI = 0; spotI < 9; spotI++) {
        cell.position.set(boardPos[spotI][0],0.1,boardPos[spotI][1])
        main.objects.push(cell)
        board.add(cell)
        cell = cell.clone()
      }

      for (let boardI = 0; boardI < 9; boardI++) {
        board.index = boardI
        board.pieces = [null]
        board.position.set(boardPos[boardI][0],10,boardPos[boardI][1])
        game.pieces[0][boardI] = board
        game.add(board)

        for (let pieceI = 1; pieceI < data.length; pieceI++) {
          board.pieces.push([null,null,null,null,null,null,null,null,null])
        }

        board.cells = board.children.slice()
        for (let cellI = 0; cellI < 9; cellI++) {
          let cell = board.cells[cellI]
          main.objects.push(cell)
          cell.material = cell.material.clone()
        }

        board = board.clone()
      }

      updateBoard()
    })
  })

  camera.position.setY(500)
  camera.position.setZ(0)
  camera.rotation.x = -90*Math.PI/180
}

function eventsInit() {
  var {camera} = main
  function cameraTrack(a) {
    var a = a || 0, aOff = a + Math.PI/2
    ,y = Math.sin(aOff)*500,z = -Math.cos(aOff)*500
    return [y, z]
  }
  function resetTarget() {
    if (main.targetCell) {
      main.targetCell.material.opacity = 0
      delete main.targetCell
    }
  }
  function setMouse(event) {
    var mouse = new THREE.Vector2(
      (event.clientX / main.canvas.clientWidth) * 2 - 1,
      (event.clientY / main.canvas.clientHeight) * -2 + 1
    )
    if (!main.mouse) main.mouse = mouse
    main.mousedX = mouse.x - main.mouse.x
    main.mousedY = mouse.y - main.mouse.y
    main.mouse = mouse
    main.mouseRaycaster.setFromCamera(mouse, main.camera)
    resetTarget()
  }
  function mouseOver() {
    var intersects = main.mouseRaycaster.intersectObjects(main.objects)
    if (intersects.length > 0) {
      var target = intersects.reduce((c, e) => {
        if (c.distance > e.distance) return e
        else return c
      })

      target = target.object

      if (target.name === 'cell') {
        target.material.opacity = 0.5
        target.material.color = [0,0,0]
        main.targetCell = target
      }
    }
  }
  function mouseTouch() {
    // main.avgdY = main.avgdY || []
    // main.avgdY.push(main.mousedY)
    // if (main.avgdY.length > 10) main.avgdY.shift()
    // var avgdY = main.avgdY.reduce((t, d) => t = [t[0]+d, ++t[1]], [0,0])
    // ,dY = avgdY[0]/avgdY[1]
    //
    // if (dY) {
    //   camera.track = Math.min(Math.max(0,(camera.track || 0) + dY),75*Math.PI/180)
    //   var track = cameraTrack(camera.track)
    //   camera.position.setY(track[0])
    //   camera.position.setZ(track[1])
    //   camera.lookAt(main.game.position)
    //   camera.rotation.z = 0
    // }
  }
  function touchEnd() {
    if (main.targetCell) {
      let target = main.targetCell, parent = target.parent
      ,index = target.parent.children.indexOf(target)
    }
  }

  main.canvas.addEventListener('mousedown', event => {
    main.mouseDown = true
  })

  main.canvas.addEventListener('touchstart', event => {
    event.clientX = event.touches[0].clientX
    event.clientY = event.touches[0].clientY
    setMouse(event)
    mouseOver()
  })

  main.canvas.addEventListener('mousemove', event => {
    setMouse(event)
    if (main.mouseDown) mouseTouch()
    mouseOver()
  })

  main.canvas.addEventListener('touchmove', event => {
    event.preventDefault()
    event.clientX = event.touches[0].clientX
    event.clientY = event.touches[0].clientY
    setMouse(event)
    mouseOver()
    mouseTouch()
  }, {passive: false})

  main.canvas.addEventListener('mouseup', event => {
    if (main.isTouch === true) return main.isTouch = false
    // Cancel this event if a touch screen is being used
    main.mouseDown = false
    touchEnd()
  })

  main.canvas.addEventListener('touchend', event => {
    main.isTouch = true
    touchEnd()
    resetTarget()
    delete main.mouse
  })
}

function toScreenPosition(vector, camera) {
  var widthHalf = 0.5*main.renderer.context.canvas.width
  ,heightHalf = 0.5*main.renderer.context.canvas.height
  vector = vector.clone()

  camera.getWorldPosition(camera.position)
  vector.project(camera)

  vector.x = ((vector.x * widthHalf) + widthHalf)/devicePixelRatio
  vector.y = (-(vector.y * heightHalf) + heightHalf)/devicePixelRatio

  return {x: vector.x, y: vector.y}
}

;(() => {
  // wsLog()
  var camera = main.camera = new THREE.PerspectiveCamera(
    45, window.innerWidth/window.innerHeight, 1, 1000
  )
  ,renderer = main.renderer = new THREE.WebGLRenderer({antialias: true})
  ,scene = main.scene = new THREE.Scene()
  ,gltfLoader = main.gltfLoader
  renderer.autoClear = false
  gltfLoader.setPath('gltf/')

  main.canvas = renderer.domElement
  renderer.setPixelRatio(window.devicePixelRatio)
  document.body.appendChild(main.canvas)

  main.info = new Promise((resolve, reject) => ws.emit('init', null, res => {
    if (res.error) reject(res)
    resolve(res)
  }))

  boardInit()
  hudInit()
  eventsInit()

  main.sizing.push({set size(v) {
    renderer.setPixelRatio(devicePixelRatio)
    renderer.setSize(v.x, v.y)
    camera.aspect = v.x/v.y
    camera.updateProjectionMatrix()
    scene.scale.x = scene.scale.z = Math.min(1.29*camera.aspect-0.042,1.2)

    var originX = toScreenPosition(new THREE.Vector3(), camera).x
    ,length = toScreenPosition(new THREE.Vector3(main.game.sidelength/2,10,0), camera).x
    ,screenMargin = v.x - 2*(length - originX)*scene.scale.x

    if (!('open' in main.hud)) {
      let hudWidth = parseFloat(main.hud.wrapper.style.width)
      if (Math.min(hudWidth+5,screenMargin) === hudWidth+5) main.hud.open = 200
      else main.hud.open = 0
      main.hud.wrapper.style.left = 'unset'
      main.hud.wrapper.style.right = main.hud.open-hudWidth + 'px'
    }

    originX = (2*originX-main.hud.open)/main.canvas.clientWidth - 1

    main.boardRaycaster.setFromCamera(new THREE.Vector2(originX*1.956, 0), camera)
    var plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0)
    ,test = main.boardRaycaster.ray.intersectPlane(plane, new THREE.Vector3())

    // console.log(originX > -.5, screenMargin > main.hud.open+5)
    if (originX > -.5 && screenMargin > main.hud.open+5) {
      scene.position.setX(test.x/2)
    }
    else scene.position.setX(0)
  }})

  function run(a) {
    renderer.render(scene, camera)
    requestAnimationFrame(run)
  }
  run()
})()
