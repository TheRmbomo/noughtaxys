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
      main.sizing.array.map(e => {e.size = {x: window.innerWidth, y: window.innerHeight}})
    }
    ,push: function(...e) {main.sizing.array.push(...e); this.resize()}
    ,remove: function(...e) {
      e.map(e => main.sizing.array.splice(main.sizing.array.indexOf(e),1))
    }
    ,array: []
  }
  ,infoStack: []
}

window.addEventListener('scroll', event => {
  event.preventDefault()
  main.sizing.push({set size(v) {
    if (v < 200) ws.emit('log', 'yes')
  }})
  document.body.scrollLeft = 0
  // document.body.scrollTop = 0
  window.scrollX = 0
  // window.scrollY = 0
}, {passive: false})
window.addEventListener('contextmenu', event => event.preventDefault())
window.addEventListener('resize', main.sizing.resize)
document.body.addEventListener('touchstart', event => {
  if (event.touches.length > 1) return event.preventDefault()
  // var {target} = event, body = document.body, html = document.documentElement
  // ws.emit('log', target.tagName)
  // var isTarget = x => {
  //   var res = (x === body || x === html)
  //   return res
  // }
  // ws.emit('log', [body.scrollWidth, body.clientWidth])
  // if (target === html) {
  //   document.body.scrollTop = 0
  //   window.scrollY = 0
  // }
  // if (isTarget(event.target)) return event.preventDefault()
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
  }, e => null)
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

  function createText(tag, text, parent) {
    var node = document.createElement(tag), textNode = document.createTextNode(text)
    node.classList.add('noselect')
    node.appendChild(textNode)
    if (parent) parent.appendChild(node)
    return node
  }

  main.info = new Promise((resolve, reject) => ws.emit('init', null, res => {
    console.log(0, res)
    if ('error' in res) return reject(res)
    if ('session' in res) {
      main.game.material.color = [0.2,0.2,0.2]
      let w = 250, h = 150, modal = {
        body: document.createElement('div')
        ,form: document.createElement('form')
        ,sizing: {set size(v) {
          modal.body.style.width = w + 'px'
          modal.body.style.height = h + 'px'
          modal.body.style.left = (v.x-w)/2 + 'px'
          if (modal.body.open) modal.body.style.top = (v.y-h)/2 + 'px'
        }}
      }
      modal.body.style.top = -h + 'px'
      modal.body.style.backgroundColor = '#445'
      modal.body.style.borderRadius = '5px'
      modal.body.classList.add('hud')
      modal.body.open = false

      main.sizing.push(modal.sizing)

      ;(() => {
        var {form} = modal
        form.style.paddingTop = form.style.paddingBottom = '0.5em'
        form.style.overflow = 'hidden'
        Object.assign(form, {
          message: createText('div', 'Enter a name')
          ,table: document.createElement('table')
          ,name_box: document.createElement('input')
          ,submit: document.createElement('input')
        })
        var {table} = form

        form.message.classList.add('hudtext')
        form.message.style.paddingBottom = '1em'
        form.name_box.type = 'text'

        table.style.tableLayout = 'fixed'
        table.row = document.createElement('tr')

        var {row} = table
        row.name_label = createText('td', 'Name:')
        row.name_label.style.width = '4em'
        row.name_label.style.textAlign = 'right'
        row.name_label.classList.add('hudtext')
        row.name_input = document.createElement('td')
        row.name_input.appendChild(form.name_box)
        form.name_box.style.width = '90%'

        row.appendChild(row.name_label)
        row.appendChild(row.name_input)
        table.appendChild(row)

        form.submit.value = 'Enter'
        form.submit.type = 'submit'
        form.submit.style.marginTop = form.submit.style.marginRight = '1em'
        form.submit.style.float = 'right'

        form.addEventListener('submit', event => {
          event.preventDefault()
          function badEnter() {console.log('badenter')}
          if (!form.name_box.value) return badEnter()
          form.submit.disabled = true
          var req = new XMLHttpRequest()
          req.onreadystatechange = function() {
            if (this.readyState === 4) {
              form.submit.disabled = false
              ws.close() // automatically reconnects
              ws.emit('session', {name: form.name_box.value}, res => {
                main.info = new Promise((resolve, reject) => ws.emit('init', null, res => {
                  console.log(res)
                  if ('error' in res) return reject(res)
                  if ('session' in res) {
                    form.submit.disabled = false
                    return reject()
                  }
                  main.game.material.color = [0xdd/255,0xdd/255,0xdd/255]
                  main.sizing.remove(modal.sizing)
                  main.hud.body.removeChild(modal.body)
                  main.infoStack.map(act => {main.info.then(act, e => e)})
                  resolve(res)
                }))
                main.info.catch(e => null)
              })
            }
          }
          req.open('GET', `/session`, true)
          req.send()
        })
        form.appendChild(form.message)
        form.appendChild(table)
        form.appendChild(form.submit)
        modal.body.appendChild(form)
      })()

      var guestOption = createText('button', 'Or start watching as a guest')
      guestOption.classList.add('hudtext')
      guestOption.style.color = '#66A'
      guestOption.style.backgroundColor = '#0000'
      guestOption.addEventListener('mouseover', event => {
        guestOption.style.color = '#88A'
      })
      guestOption.addEventListener('mouseout', event => {
        guestOption.style.color = '#66A'
      })
      guestOption.addEventListener('mousedown', event => {
        guestOption.style.color = '#224'
      })
      guestOption.addEventListener('mouseup', event => {
        guestOption.style.color = '#88A'
      })
      modal.body.appendChild(guestOption)

      animate(time => {
        var pos = parseFloat(modal.body.style.top) + 10, end = (window.innerHeight-h)/2
        modal.body.style.top = pos + 'px'
        if (pos < end) return true
        else {
          modal.body.style.top = end + 'px'
          modal.body.open = true
        }
      })

      main.hud.body.appendChild(modal.body)
      return reject()
    }
    resolve(res)
  }))

  ;(function boardInit() {
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

    var boardInfo = info => {
      info.pieces[0] = 'board'
      var models = info.pieces.map(name => loadMesh(name + '.gltf').catch(e => null))
      return Promise.all(models).then(data => {
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
    }
    main.info.then(boardInfo, e => null)
    main.infoStack.push(boardInfo)

    camera.position.setY(500)
    camera.position.setZ(0)
    camera.rotation.x = -90*Math.PI/180
  })()
  ;(function hudInit() {
    var hud = main.hud = {
      body: document.createElement('div')
      ,statusboard: {
        wrapper: document.createElement('div'), body: document.createElement('div')
      }
    }
    ,{statusboard} = hud

    hud.body.style.position = 'absolute'
    hud.body.style.top = 0
    hud.body.classList.add('nopointer')
    statusboard.wrapper.appendChild(statusboard.body)
    statusboard.wrapper.classList.add('hud')
    statusboard.wrapper.style.overflow = 'auto'

    var playerList = main.playerList = {
      label: createText('div', 'Player List')
      ,body: document.createElement('table')
      ,loading: createText('div', 'Loading...')
      ,header: document.createElement('tr')
      ,hr: document.createElement('hr')
    }
    playerList.label.classList.add('hudtext', 'hudlabel')
    playerList.hr.style.display = 'none'
    statusboard.body.appendChild(playerList.label)
    statusboard.body.appendChild(document.createElement('hr'))
    statusboard.body.appendChild(playerList.loading)

    var playerListInfo = info => {
      playerList.hr.style.display = ''
      statusboard.body.removeChild(playerList.loading)
      createText('td', 'Name', playerList.header)
      createText('td', 'Wins', playerList.header)
      createText('td', 'Piece', playerList.header)
      playerList.body.appendChild(playerList.header)
      info.players.map(player => {
        var playerListing = document.createElement('tr')
        createText('td', player.name, playerListing)
        createText('td', player.wins, playerListing)
        createText('td', player.piece, playerListing)
        playerList.body.appendChild(playerListing)
      })
    }
    main.info.then(playerListInfo, e => hud.body.removeChild(statusboard.wrapper))
    main.infoStack.push(() => hud.body.appendChild(statusboard.wrapper), playerListInfo)
    statusboard.body.appendChild(playerList.body)
    statusboard.body.appendChild(playerList.hr)

    var infobox = {
      body: document.createElement('div')
      ,games: createText('div', 'Games: '), draws: createText('div', 'Draws: ')
    }
    ,infoboxInfo = info => {
      infobox.body.appendChild(infobox.games)
      infobox.body.appendChild(infobox.draws)
      infobox.games.appendChild(document.createTextNode(info.games))
      infobox.draws.appendChild(document.createTextNode(info.draws))
    }
    main.info.then(infoboxInfo, e => null)
    main.infoStack.push(infoboxInfo)
    statusboard.body.appendChild(infobox.body)

    var bottombox = {
      body: document.createElement('div')
      ,viewers: createText('div', 'Viewers: ')
      ,chat: createText('button', 'Chat'), settings: createText('button', 'Settings')
    }
    Object.assign(bottombox.body.style, {
      position: 'relative', paddingTop: '20px', width: '100%', textAlign: 'left', bottom: 0
    })
    bottombox.viewers.style.textAlign = 'right'
    bottombox.viewers.style.marginRight = '10px'
    bottombox.chat.type = 'button'
    bottombox.settings.style.float = 'right'
    bottombox.settings.type = 'button'
    var bottomboxInfo = info => {
      bottombox.body.appendChild(bottombox.viewers)
      bottombox.body.appendChild(document.createElement('hr'))
      bottombox.body.appendChild(bottombox.chat)
      bottombox.body.appendChild(bottombox.settings)
      bottombox.viewers.appendChild(document.createTextNode(info.viewers.length))
    }
    main.info.then(bottomboxInfo, e => null)
    main.infoStack.push(bottomboxInfo)
    statusboard.body.appendChild(bottombox.body)

    main.sizing.push({set size(v) {
      if (v.x < 200) hud.body.style.display = 'none'
      else if (hud.body.style.display === 'none') hud.body.style.display = ''
      var w = 200, h = v.y, x = v.x - w

      var docWidth = document.documentElement.offsetWidth;

      hud.body.style.width = v.x + 'px'
      hud.body.style.height = v.y + 'px'

      var statusboardInfo = info => {
        statusboard.wrapper.style.height = 'auto'
        var compHeight = parseFloat(getComputedStyle(statusboard.wrapper).height)
        if (compHeight) h = Math.min(compHeight, v.y)
        statusboard.wrapper.style.height = h+1 + 'px'
      }
      main.info.then(statusboardInfo, e => null)
      main.infoStack.push(statusboardInfo)
      Object.assign(statusboard.wrapper.style, {
        width: w + 'px'
      })
    }})

    hud.body.appendChild(statusboard.wrapper)
    document.body.appendChild(hud.body)
  })()
  ;(function eventsInit() {
    var {camera} = main
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
      function cameraTrack(a) {
        var a = a || 0, aOff = a + Math.PI/2
        ,y = Math.sin(aOff)*500,z = -Math.cos(aOff)*500
        return [y, z]
      }
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

        ws.emit('move', [parent.index, index])
      }
    }

    main.canvas.addEventListener('mousedown', event => {
      main.mouseDown = true
    })
    main.canvas.addEventListener('mousemove', event => {
      setMouse(event)
      if (main.mouseDown) mouseTouch()
      mouseOver()
    })
    main.canvas.addEventListener('mouseup', event => {
      if (main.isTouch === true) return main.isTouch = false
      // Cancel this event if a touch screen is being used
      main.mouseDown = false
      touchEnd()
    })

    main.canvas.addEventListener('touchstart', event => {
      event.clientX = event.touches[0].clientX
      event.clientY = event.touches[0].clientY
      setMouse(event)
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
    main.canvas.addEventListener('touchend', event => {
      main.isTouch = true
      touchEnd()
      resetTarget()
      delete main.mouse
    })
  })()

  main.sizing.push({set size(v) {
    main.canvas.style.width = '0px'
    main.canvas.style.height = '0px'
    document.body.style.height = v.y + 'px'
    renderer.setPixelRatio(devicePixelRatio)
    renderer.setSize(v.x, v.y)
    camera.aspect = v.x/v.y
    camera.updateProjectionMatrix()
    scene.scale.x = scene.scale.z = Math.min(1.29*camera.aspect-0.042,1.2)

    var originX = toScreenPosition(new THREE.Vector3(), camera).x
    ,length = toScreenPosition(new THREE.Vector3(main.game.sidelength/2,10,0), camera).x
    ,screenMargin = v.x - 2*(length - originX)*scene.scale.x
    ,{statusboard} = main.hud

    if (!('open' in statusboard)) {
      let hudW = parseFloat(statusboard.wrapper.style.width)
      if (Math.min(hudW+5,screenMargin) === hudW+5) statusboard.open = 200
      else statusboard.open = 0
      statusboard.wrapper.style.right = statusboard.open-hudW + 'px'
    }

    originX = (2*originX-statusboard.open)/main.canvas.clientWidth - 1

    main.boardRaycaster.setFromCamera(new THREE.Vector2(originX*1.956, 0), camera)
    var plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0)
    ,test = main.boardRaycaster.ray.intersectPlane(plane, new THREE.Vector3())
  }})

  ;(function loop(a) {
      renderer.render(scene, camera)
      if (!main.exit) requestAnimationFrame(loop)
    })()
})()
