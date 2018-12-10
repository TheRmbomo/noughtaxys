let main = {
  mouseRaycaster: new THREE.Raycaster(), boardRaycaster: new THREE.Raycaster()
  ,gltfLoader: new THREE.GLTFLoader()
  ,camera: new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 1000)
  ,renderer: new THREE.WebGLRenderer({antialias: true}), scene: new THREE.Scene()
  ,objects: [], passes: []
  ,boardPosition: y => (unit => [
    [-unit, y, -unit], [0, y, -unit], [unit, y, -unit],
    [-unit, y,     0], [0, y,     0], [unit, y,     0],
    [-unit, y,  unit], [0, y,  unit], [unit, y,  unit]
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
  ,init: true, update: {actions: []}
  ,id: document.getElementById('id').innerText
}

function eventListeners(element, events) {
  Object.keys(events).map(event => {
    if (typeof events[event] === 'function') element.addEventListener(event, events[event])
    else if (Array.isArray(events[event])) {
      element.addEventListener(event, events[event][0], events[event][1])
    }
  })
}

eventListeners(window, {
  contextmenu: event => event.preventDefault()
  ,resize: main.sizing.resize
  ,touchstart: [event => event.preventDefault(), {capture: false, passive: false}]
})

function createMesh(geometry, opt) {
  opt = Object.assign({color: 0xffffff, opacity: 1, transparent: false}, opt)
  if (opt.opacity !== 1) opt.transparent = true
  var material = new THREE.MeshBasicMaterial({
    color: opt.color, opacity: opt.opacity, transparent: opt.transparent
  })
  ,mesh = new THREE.Mesh(geometry, material)
  if (opt.t) mesh.position.set(...opt.t)
  if (opt.n) mesh.name = opt.n
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

function updateGame(info) {
  var {game} = main, pieces = info.pieces.length

  function unsetCell(cell) {
    // Remove cell pad from click/touch events
    cell.material.opacity = 0
    let cellI = main.objects.indexOf(cell)
    if (cellI !== -1) main.objects.splice(cellI,1)
  }

  function setWinner(board) {
    let boardI = board.i, {winner} = board.s, piece = board.c.winPiece
    if (piece) {
      if (piece.winner !== winner) {
        game.remove(piece.mesh)
        board.c.winPiece = null
        if (winner === 0 || winner >= pieces) {
          for (let pieceI = 0; pieceI < 9; pieceI++) {
            if (main.myTurn && !board.c.pieces[pieceI]) {
              main.objects.push(board.c.children[pieceI])
            }
          }
        }
      } else return
    }

    if (winner !== 0 && winner < pieces) {
      for (let pieceI = 0; pieceI < 9; pieceI++) unsetCell(board.c.children[pieceI])

      let mesh = main.models[board.s.winner].clone()
      mesh.position.set(...(x => [x[0],10,x[1]])(main.boardPosition[boardI]))
      mesh.visible = true
      board.c.winPiece = {mesh, winner}
      game.add(mesh)

      if ('win' in board.s) {
        for (let winI = 0; winI < board.s.win.length; winI++) {
          let cellI = board.s.win[winI], cellMat = board.c.cells[cellI].material
          cellMat.color = [1,0,0]
          cellMat.transparency = false
          cellMat.opacity = 1
        }
      }
    }
  }
  function setPiece(board, pieceI) {
    let boardI = board.i, type = board.s.board[pieceI], piece = board.c.pieces[pieceI]
    ,cell = board.c.children[pieceI]
    if (piece) {
      if (piece.type !== type) {
        board.c.remove(piece.mesh)
        board.c.pieces[pieceI] = null
        // Re-add cell pad to touch events
        if (main.myTurn && !board.s.winner && (type === 0 || type >= pieces)) {
          main.objects.push(cell)
        }
      } else return unsetCell(cell)
    }

    if (type !== 0 && type < pieces) {
      unsetCell(cell)

      let mesh = main.models[type].clone()
      mesh.position.set(...main.boardPosition(0.5)[pieceI])
      mesh.visible = true
      board.c.pieces[pieceI] = {mesh, type}
      board.c.add(mesh)
    } else if (main.myTurn && type === 0) {
      if (main.objects.indexOf(cell) === -1) main.objects.push(cell)
    } else {
      let cellIndex = main.objects.indexOf(cell)
      if (cellIndex !== -1) main.objects.splice(cellIndex, 1)
    }
  }

  for (let boardI = 0; boardI < game.boards.length; boardI++) {
    let board = {i: boardI, c: game.boards[boardI], s: info.game[boardI]}
    if ('winner' in board.s) setWinner(board)
    for (let pieceI = 0; pieceI < 9; pieceI++) setPiece(board, pieceI)
  }

  return
}

;(() => {
  // -f Scene Creation
  var {camera, renderer, scene} = main
  camera.position.setY(500); camera.position.setZ(0)
  camera.rotation.x = -90*Math.PI/180
  renderer.autoClear = false
  main.gltfLoader.setPath('gltf/')
  main.canvas = renderer.domElement.makeChildOf(document.body)
  renderer.setPixelRatio(window.devicePixelRatio)

  var composer = main.composer = new THREE.EffectComposer(renderer)
  ,renderPass = new THREE.RenderPass(scene, camera)
  ,pass1 = new THREE.ShaderPass(THREE.HorizontalBlurShader)
  ,pass2 = new THREE.ShaderPass(THREE.VerticalBlurShader)
  pass1.enabled = pass2.enabled = false
  main.passes.push(renderPass, pass1, pass2)
  composer.addPasses(renderPass, pass1, pass2)
  renderPass.renderToScreen = true

  composer.render()

  main.sizing.push({set size(v) {
    main.canvas.style.width = '0px'
    main.canvas.style.height = '0px'
    document.body.style.height = v.y + 'px'
    renderer.setPixelRatio(devicePixelRatio)
    renderer.setSize(v.x, v.y)
    camera.aspect = v.x / v.y

    THREE.HorizontalBlurShader.uniforms.h.value = 1 / v.x
    THREE.VerticalBlurShader.uniforms.v.value = 1 / v.y

    camera.updateProjectionMatrix()
    scene.scale.x = scene.scale.z = Math.min(1.29*camera.aspect-0.042,1.2)
    composer.render()
  }})
  // --f

  ws.emit('view', main.id)

  function createText(tag, text, parent) {
    var node = document.createElement(tag), textNode = document.createTextNode(text)
    node.classList.add('noselect')
    node.appendChild(textNode)
    if (parent) parent.appendChild(node)
    return node
  }
  function createModal(opt) {
    opt = Object.assign({w: 250}, opt)
    var modal = document.createElement('div').makeChildOf(main.hud), style = {
      width: opt.w + 'px', top: (-opt.h || 0) + 'px', backgroundColor: '#445',
      borderRadius: '5px', minHeight: '2em'
    }
    if (opt.h) style.height = opt.h + 'px'

    modal.setStyle(style)
    modal.classList.add('hud')
    modal.open = false
    modal.sizing = {set size(v) {
      var style = {left: (v.x-opt.w)/2 + 'px'}
      opt.w = parseFloat(getComputedStyle(modal).width) || opt.w
      opt.h = parseFloat(getComputedStyle(modal).height) || opt.h
      if (modal.open) style.top = (v.y-opt.h)/2 + 'px'
      modal.setStyle(style)
    }}
    main.sizing.push(modal.sizing)

    animate(time => {
      opt.w = parseFloat(getComputedStyle(modal).width) || opt.w
      opt.h = parseFloat(getComputedStyle(modal).height) || opt.h || 0
      var pos = parseFloat(modal.style.top) + 10, end = (window.innerHeight-opt.h)/2
      modal.style.top = pos + 'px'
      if (pos < end) return true
      else {
        modal.style.top = end + 'px'
        modal.open = true
      }
    })

    return modal
  }

  // -f Load Game
  var boardPosition = main.boardPosition, sidelength = 320
  ,loadMesh = file => new Promise((resolve, reject) => {
    main.gltfLoader.load(file, obj => resolve(obj.scene.children[0]), null, reject)
  })

  var game = main.game = createBox({s: [sidelength, 20, sidelength], color: 0xdddddd})
  Object.assign(game, {name: 'game', boards: [], sidelength})
  scene.add(game)

  loadMesh('board.gltf').then(board => {
    board.scale.x = board.scale.z = 3/10

    var cell = createSquare({s: [100,100], opacity: 0, t: [0,20,0], n: 'cell'})

    for (let spotI = 0; spotI < 9; spotI++) {
      cell.position.set(...boardPosition(0.1)[spotI])
      board.add(cell)
      cell = cell.clone()
    }

    for (let boardI = 0; boardI < 9; boardI++) {
      board.index = boardI
      board.winPiece = null
      board.pieces = [null, null, null, null, null, null, null, null, null]
      board.position.set(...boardPosition(10)[boardI])
      game.boards[boardI] = board
      game.add(board)

      board.cells = board.children.slice()
      for (let cellI = 0; cellI < 9; cellI++) {
        let cell = board.cells[cellI]
        cell.index = cellI
        cell.material = cell.material.clone()
      }

      board = board.clone()
    }
    composer.render()
  })

  var hud = main.hud = document.createElement('div').makeChildOf(document.body)
  .setStyle({position: 'absolute', top: 0})
  hud.classList.add('nopointer', 'noselect')
  hud.params = {w: 200}

  main.sizing.push({set size(v) {
    let {w} = hud.params
    if (v.x < w) hud.style.display = 'none'
    else if (hud.style.display === 'none') hud.style.display = ''

    hud.style.width = v.x + 'px'
    hud.style.height = v.y + 'px'
  }})

  function infoMiddleware(info) {
    if ('error' in info) return location.href = base_href + '/?error=' + info.error
    info.isCreator = info.creator === info.self.id
    return info
  }

  // -f HUD
  function makeStatusboard(info) {
    var status = document.createElement('div').makeChildOf(hud)
    .setStyle({overflow: 'auto'}).addClasses('hud')

    document.createElement('div').makeChildOf(status, 'body')
    .setStyle({paddingTop: '0.5em', paddingBottom: '0.5em'})

    if (info.name) status.body.addChildren(
      createText('div', info.name), 'name', document.createElement('hr')
    )

    hud.playerlist = document.createElement('div').makeChildOf(status.body).addChildren(
      document.createElement('table').addChildren(
        document.createElement('tr')
        .addChildren(...['Name', 'Wins', 'Piece'].map(n => createText('td', n)))
      )
      ,'table'
      ,createText('div', 'Viewers: ')
      .addChildren(document.createTextNode(info.viewers.length), 'count')
      .setStyle({textAlign: 'right', marginRight: '1em', marginTop: '1em'}), 'viewers'
    )

    document.createElement('hr').makeChildOf(status.body)

    hud.infobox = document.createElement('div').makeChildOf(status.body).addChildren(
      createText('div', 'Games: ')
      .addChildren(document.createTextNode(info.games || 0), 'count'), 'games'
      ,createText('div', 'Draws: ')
      .addChildren(document.createTextNode(info.draws || 0), 'count'), 'draws'
    )

    document.createElement('hr').makeChildOf(status.body)

    var bottombox = document.createElement('div').makeChildOf(status.body)
    .setStyle({textAlign: 'left'}).addChildren(
      createText('button', 'Chat'), 'chat'
      ,createText('button', 'Settings').setStyle({float: 'right'}), 'settings'
    )

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

    main.sizing.push({set size(v) {
      var {w} = hud.params, h = v.y, newStyle = {width: w + 'px'}
      if (main.info) {
        status.style.height = 'auto'
        var compHeight = parseFloat(getComputedStyle(status).height)
        if (compHeight) h = Math.min(compHeight, v.y)
        status.style.height = h+1 + 'px'
      }

      var originX = toScreenPosition(new THREE.Vector3(), camera).x
      ,length = toScreenPosition(new THREE.Vector3(main.game.sidelength/2,10,0), camera).x
      ,screenMargin = v.x - 2*(length - originX)*scene.scale.x

      if (!('open' in status.body)) {
        let hudW = parseFloat(newStyle.width)
        if (Math.min(hudW + 5, screenMargin) === hudW + 5) status.body.open = 200
        else status.body.open = 0
        newStyle.right = status.body.open - hudW + 'px'
      }

      status.setStyle(newStyle)
    }})

    main.update.actions.push((info) => {
      var {info} = main
      if (main.update.players) {
        main.update.players = false
        let {playerlist} = hud
        while (playerlist.table.children.length > 1) {
          playerlist.table.removeChild(playerlist.table.children[1])
        }
        info.players.map(player => {
          var playerListing = document.createElement('tr').makeChildOf(playerlist.table)
          ;[player.n, player.w, info.players.indexOf(player)+1]
          .map(n => createText('td', n, playerListing))
        })
        var currentPlayer = playerlist.table.children[info.currentPlayer + 1]
        if (currentPlayer) currentPlayer.style.backgroundColor = '#DDF'
        playerlist.viewers.count.data = info.viewers.length
      }
      if (main.update.gameCount) {
        main.update.gameCount = false
        let {infobox} = hud
        infobox.games.count.data = info.games || 0
        infobox.draws.count.data = info.draws || 0
      }
    })
  }
  // --f

  // -f State 0 -- Creation
  function state0(info) {
    var modal = createModal().setStyle({color: '#FFF'})
    if (!info.isCreator) {
      createText('div', 'Waiting for the host to finish creating the game...')
      .makeChildOf(modal)
      .setStyle({width: '100%', padding: '0.5em', backgroundColor: '#334'})
    } else {
      modal.setStyle({width: 'auto', minWidth: '250px'})
      let form = document.createElement('form')
      .setStyle({marginTop: '0.5em'}).makeChildOf(modal)
      ,inputs = {}, dom = {}, radio_state = {pieces_host: true, pieces_players: false}
      ,key

      createText('div','Game Settings').makeChildOf(form)

      let radioAttributes = (name,type) => ['type','radio','name',name,'id',type,'value',type]
      // -f Name Field
      key = 'opt_name'
      var skippingFont = {fontSize: '0.7em'}
      ,skip = document.createElement('div')
      .addChildren(createText('div','Optional: Add a name').setStyle(skippingFont), 'label')
      .setStyle({display: 'flex', justifyContent: 'flex-end', marginTop: '0.5em'})

      dom.name = document.createElement('div').makeChildOf(form, key)
      .setStyle({backgroundColor: '#556', padding: '0.5em', marginTop: '0.5em'})
      .addChildren(
        document.createElement('div').setStyle({display: 'flex'}).addChildren(
          createText('label', 'Game Name:').setStyle({flex: '0 50%'})
          .setAttributes('for', 'name')
          ,inputs.name = document.createElement('input').setStyle({width: 0, flex: 1})
          .setAttributes('id','name')
        )
        ,skip
      )

      inputs.name.addEventListener('keydown', event => {
        setTimeout(() => {
          if (!(inputs.name.value)) {
            if (skip.label) {
              skip.removeChild(skip.label)
              delete skip.label
              createText('div','Skipping name').setStyle(skippingFont).makeChildOf(skip)
            }
            skip.style.visibility = ''
          } else if (inputs.name.value) {
            skip.style.visibility = 'hidden'
          }
        })
      })
      // --f
      // -f Join As Player
      key = 'opt_join'
      inputs[key] = []
      document.createElement('div').makeChildOf(form, key).setStyle({
        backgroundColor: '#556', padding: '0.25em 0', display: 'flex', marginTop: '0.2em'
      }).addChildren(
        inputs[key][0] = document.createElement('input')
        .setAttributes('type','checkbox','id',key)
        ,createText('label', 'Joining this Game?').setAttributes('for', key)
      )
      // --f
      // -f Piece Select Field
      // key = 'opt_piece'
      // let pieceAttributes = type => radioAttributes(key, type)
      // inputs[key] = []
      // document.createElement('div').makeChildOf(form, key)
      // .setStyle({backgroundColor: '#334', padding: '0.25em 0'})
      // .addChildren(
      //   document.createElement('div').setStyle({display: 'flex'}).addChildren(
      //     inputs[key][0] = document.createElement('input')
      //     .setAttributes(...pieceAttributes('pieces_host'),'checked','true')
      //     ,createText('label', 'Choose Game Pieces').setAttributes('for','pieces_host')
      //   )
      //   ,dom.pieces = document.createElement('div')
      //   .setStyle({display: 'flex', padding: '0.2em 0'})
      //   ,document.createElement('div').setStyle({display: 'flex', marginTop: '0.8em'})
      //   .addChildren(
      //     inputs[key][1] = document.createElement('input')
      //     .setAttributes(...pieceAttributes('pieces_players'))
      //     ,createText('label', 'Allow Player Choice').setAttributes('for','pieces_players')
      //   )
      //   ,dom.pieces_cover = document.createElement('div').setStyle({position: 'absolute'})
      // )
      //
      // let makePiece = src => document.createElement('img').addClasses('piece')
      // .setAttributes('draggable', false, 'src', src)
      //
      // dom.pieces.addChildren(
      //   makePiece('img/thumbnails/cross.png'), makePiece('img/thumbnails/circle.png')
      // )
      // dom.pieces_cover.setStyle({
      //   left: dom.pieces.offsetLeft + 'px', width: dom.pieces.offsetWidth + 'px'
      //   ,top: dom.pieces.offsetTop + 'px', height: dom.pieces.offsetHeight + 'px'
      // })
      //
      // inputs[key][0].addEventListener('click', event => {
      //   if (radio_state.pieces_host) return
      //   radio_state.pieces_host = true
      //   radio_state.pieces_players = false
      //   dom.pieces_cover.setStyle({backgroundColor: '#0000'})
      // })
      //
      // inputs[key][1].addEventListener('click', event => {
      //   if (radio_state.pieces_players) return
      //   radio_state.pieces_host = false
      //   radio_state.pieces_players = true
      //   dom.pieces_cover.setStyle({backgroundColor: '#8888'})
      // })
      // --f
      // -f Public/Private Field
      // key = 'opt_vis'
      // let visAttributes = type => radioAttributes(key, type)
      // inputs[key] = []
      // document.createElement('div').makeChildOf(form, key)
      // .setStyle({display: 'flex', justifyContent: 'center', margin: '0.5em'})
      // .addChildren(
      //   document.createElement('div').addChildren(
      //     inputs[key][0] = document.createElement('input')
      //     .setAttributes(...visAttributes('public'),'checked','true')
      //     ,createText('label', 'Public').setAttributes('for','public')
      //   )
      //   ,document.createElement('div').addChildren(
      //     inputs[key][1] = document.createElement('input')
      //     .setAttributes(...visAttributes('private'))
      //     ,createText('label', 'Private').setAttributes('for','private')
      //   )
      // )
      // --f

      document.createElement('input').setStyle({textAlign: 'center'})
      .setAttributes('type','submit','value','Create')
      .makeChildOf(
        document.createElement('div').setStyle({marginTop: '0.5em'}).makeChildOf(form)
      )

      createText('button', 'Return to Menu').setStyle({
        textAlign: 'center', backgroundColor: '#544', color: '#DDD'
      }).makeChildOf(
        document.createElement('div').setStyle({marginTop: '0.5em', marginBottom: '0.5em'})
        .makeChildOf(modal, 'cancel')
      )

      form.addEventListener('submit', event => {
        event.preventDefault()
        var values = {}
        Object.keys(inputs).map(key => {
          if (Array.isArray(inputs[key])) {
            for (var i = 0; i < inputs[key].length; i++) {
              if (!inputs[key][i].checked) continue
              values[key] = inputs[key][i].value
              break
            }
            if (!values[key]) values[key] = false
          } else values[key] = inputs[key].value
        })

        ws.emit('create', {id: main.id, values}, info => {
          if (info && 'error' in info) return console.error(info)
          inputs.name.value = ''
          hud.removeChild(modal)
          state1(infoMiddleware(info))
        })
      })

      modal.cancel.addEventListener('click', event => location.href = base_href + '/')
    }
  }
  // --f

  // -f State 1 -- Open Lobby
  function state1(info) {
    // -f Modal
    function setModal(info) {
      var modal = createModal().setStyle({color: '#FFF'})

      if (!info.isCreator) {
        createText('div', 'Waiting for players to join...').makeChildOf(modal).setStyle({
          width: '100%', padding: '0.5em', backgroundColor: '#334', marginTop: '0.5em'
        })
      } else {
        createText('div','Invite players or viewers with the link below').makeChildOf(modal)
        .setStyle({margin: '0.5em'})

        let text, dom = {}
        document.createElement('div').makeChildOf(modal).setStyle({
          display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '0.5em'
        }).addChildren(
          text = createText('textarea', location.href)
          .setAttributes('readonly','true','wrap','soft')
          ,dom.copy = document.createElement('button').setStyle({
            width: '1em', height:'1em', padding: '2px'
            ,background: 'url(img/copy.png) center center no-repeat'
            ,backgroundSize: '90% 90%',marginLeft: '0.5em'
          })
        )
        text.setStyle({height: text.scrollHeight+2+'px', resize: 'none'})

        createText('div','Waiting for players...').makeChildOf(modal)
        .setStyle({marginTop: '0.5em'})

        dom.copy.addEventListener('touchstart', event => {
          dom.copy.dispatchEvent(new MouseEvent('click'))
        }, {passive: false})

        dom.copy.addEventListener('click', event => {
          copyTextToClipboard(location.href).then(() => {
            document.body.scrollTop = 0
            var rect = dom.copy.getBoundingClientRect()
            var tooltip = document.createElement('div').makeChildOf(hud).setStyle({
              display: 'flex', justifyContent: 'center', padding: '0.2em'
              ,position: 'absolute', backgroundColor: '#FFF'
              ,top: rect.y - 20 + 'px', left: rect.x - rect.width/2 + 'px'
            }).addChildren(createText('span','Copied').setStyle({fontSize: '0.5em'}))
            setTimeout(() => hud.removeChild(tooltip), 1000)
          }).catch(console.error)
        })
      }

      var isPlayer = info.players.map(player => player.id).indexOf(info.self.id) !== -1
      ,button, dom = {}

      if (isPlayer || 'name' in info.self) {
        var text = isPlayer ? 'Leave Game' : 'Join Game'
        button = createText('button', text).makeChildOf(
          document.createElement('div').setStyle({marginTop: '0.5em', marginBottom: '0.5em'})
          .makeChildOf(modal)
        )

        button.addEventListener('click', event => {
          ws.emit('player', main.id, info => {
            if ('error' in info) return console.error(info)
            hud.removeChild(modal)
            main.update.players = true
            setModal(infoMiddleware(info))
          })
        })
      } else {
        createText('div', 'In order to join, enter your display name below')
        .makeChildOf(modal).setStyle({padding: '0.5em'})

        let form = document.createElement('form').makeChildOf(modal)
        .setStyle({display: 'flex', padding: '0.5em'})
        .addChildren(
          dom.name = document.createElement('input').setStyle({width: 0, flex: 3})
          ,document.createElement('div').setStyle({flex: 1}).addChildren(
            button = document.createElement('input')
            .setAttributes('type','submit','value','Join')
          )
        )

        form.addEventListener('submit', event => {
          event.preventDefault()
          if (!dom.name.value) return console.error('need a name')
          var req = new XMLHttpRequest()
          req.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
              ws.close()
              ws.emit('player', main.id, info => {
                if ('error' in info) return console.error(info)
                hud.removeChild(modal)
                main.update.players = true
                setModal(infoMiddleware(info))
              })
            }
          }
          req.open("GET", "/setToken?name=" + dom.name.value, true)
          req.send()
        })
      }

      if (info.isCreator) {
        createText('button', 'Close Game').makeChildOf(
          document.createElement('div').setStyle({marginTop: '0.5em', marginBottom: '0.5em'})
          .makeChildOf(modal)
        ).addEventListener('click', event => {
          ws.emit('closegame', main.id, res => {
            if ('error' in res) return console.error(res)
            location.href = '/'
          })
        })
      }
    }
    setModal(info)
    // --f

    makeStatusboard(info)
  }
  // --f

  // -f State 2 -- Game
  function state2(info) {
    console.log(info)
    makeStatusboard(info)

    var models = info.pieces.map(name => (
      name ? loadMesh(name + '.gltf').catch(e => null) : null
    ))

    Promise.all(models).then(data => {
      for (let pieceI = 1; pieceI < data.length; pieceI++) {
        data[pieceI].name = info.pieces[pieceI]
      }

      main.models = data
    })

    animate(() => {
      composer.render()
      if (main.models) updateGame(main.info)
      return !main.exit ? true : main.exit = false
    })
  }
  // --f

  var states = [state0, state1, state2]

  ws.emit('info', main.id, info => {
    infoMiddleware(info)
    main.info = info
    main.state = info.state
    main.currentPlayer = info.currentPlayer || -1
    main.currentBoard = info.currentBoard || -1
    try {states[info.state](info)}
    catch (e) {console.error(e)}
  })

  game.refresh = setInterval(() => ws.emit('info', main.id, info => {
    infoMiddleware(info)
    main.info = info

    if (main.init) {
      main.init = false
      main.update.players = main.update.gameCount = true
    }

    if (main.state !== info.state) {
      main.exit = true
      if (main.state === 1 && info.state === 2) {
        console.log('running')
      }
      main.state = info.state
    }

    if (info.state === 2) {
      if (main.currentPlayer !== info.currentPlayer) {
        main.update.players = true
        main.currentPlayer = info.currentPlayer
      }
      let self = info.players.map(player => player.id).indexOf(info.self.id)
      main.myTurn = info.currentPlayer === self
    }
    main.update.actions.map(action => action(info))
    main.sizing.resize()
  }), 500)

  // -f Events Init
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
  function mouseTouch() {}
  function touchEnd() {
    if (main.targetCell) {
      let target = main.targetCell, parent = target.parent

      ws.emit('move', {id: main.id, move: [parent.index, target.index]}, info => {
        if ('error' in info) return console.error(info)
        main.info = info
      })
    }
  }

  eventListeners(main.canvas, {
      mousedown: event => {main.mouseDown = true}
      ,mousemove: event => {
        setMouse(event)
        if (main.mouseDown) mouseTouch()
        mouseOver()
      }
      ,mouseup: event => {
        if (main.isTouch === true) return main.isTouch = false
        // Cancel this event if a touch screen is being used
        main.mouseDown = false
        touchEnd()
      }
      ,touchstart: [event => {
        event.clientX = event.touches[0].clientX
        event.clientY = event.touches[0].clientY
        setMouse(event)
        mouseOver()
      }, {passive: false}]
      ,touchmove: [event => {
        event.preventDefault()
        event.clientX = event.touches[0].clientX
        event.clientY = event.touches[0].clientY
        setMouse(event)
        mouseOver()
        mouseTouch()
      }, {passive: false}]
      ,touchend: [event => {
        event.preventDefault()
        main.isTouch = true
        touchEnd()
        resetTarget()
        delete main.mouse
      }, {passive: false}]
    })
  // --f
  // --f
})()
