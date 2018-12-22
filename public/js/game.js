// ws.on('refresh', location.reload)
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
      main.sizing.array.map(e => e({x: window.innerWidth, y: window.innerHeight}))
    }
    ,push: function(fn) {
      main.sizing.array.push(fn)
      fn({x: window.innerWidth, y: window.innerHeight})
      return fn
    }
    ,remove: function(...e) {
      e.map(e => main.sizing.array = main.sizing.array.filter(i => i !== e))
    }
    ,array: []
  }
  ,init: true, update: {actions: []}
  ,state: 0, id: document.getElementById('id').innerText
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

function updateGame(info, reset = false) {
  var {game} = main
  if (!reset) {
    var pieces = info.pieces.length
    ,self = info.players.map(player => player.id).indexOf(info.self.id)
    ,myTurn = info.currentPlayer === self
    info.currentBoard || -1
  }

  function color(object, type) {
    function set(opacity, color) {
      object.material.opacity = opacity
      object.material.color = color
      if (object.state) {
        object.state.opacity = opacity
        object.state.color = color
      }
    }
    switch (type) {
      case 'unset': set(0, [0,0,0]); break
      case 'win': set(0.7, [0,0.2,0.7]); break
      case 'available': set(0.2, [0,1,0]); break
      case 'warning': set(0.2, [1,1,0]); break
      case 'opponent_win': set(1, [0.7,0,0]); break
      case 'opponent_available': set(0.2, [1,0,1]); break
      case 'opponent_warning': set(0.2, [1,0.4,0.7]); break
      case 'won': set(0.5, object.myWin ? [0.2,0.4,1] : [1,0,0]); break
      case 'bg_won': set(0.2, object.myWin ? [0.2,0.4,1] : [1,0,0]); break
      default: set(0.5, [0,0,0])
    }
  }
  function unsetCell(cell) {
    // Remove cell pad from click/touch event
    let cellI = main.objects.indexOf(cell)
    if (cellI !== -1) main.objects.splice(cellI,1)
  }

  function setWinner(board) {
    var boardI = board.i, piece = board.c.winPiece
    if (!reset) { var {winner} = board.s, hasWinner = winner !== 0 && winner < pieces }
    else { var winner = null, hasWinner = false }

    if (piece && piece.winner !== winner) {
      game.remove(piece.mesh)
      board.c.winPiece = null
      if (!hasWinner && !reset) { for (let pieceI = 0; pieceI < 9; pieceI++) {
        if (myTurn && !board.c.pieces[pieceI]) main.objects.push(board.c.children[pieceI])
      } }
    }

    if (hasWinner) {
      var myWin = info.players[winner - 1].id === info.self.id
      for (let pieceI = 0; pieceI < 9; pieceI++) {
        let cell = board.c.children[pieceI]
        unsetCell(cell)
        color(cell, 'unset')
      }

      let mesh = main.models[board.s.winner].clone()
      mesh.position.set(...main.boardPosition(10)[boardI])
      mesh.visible = true
      board.c.winPiece = {mesh, winner}
      board.bg.myWin = myWin
      color(board.bg, 'bg_won')
      game.add(mesh)

      if ('win' in board.s) { for (let winI = 0; winI < board.s.win.length; winI++) {
        let cellI = board.s.win[winI], cell = board.c.cells[cellI]
        cell.myWin = myWin
        cell.won = true
      } }
    }
  }
  function setPiece(board, pieceI) {
    var boardI = board.i, piece = board.c.pieces[pieceI], cell = board.c.children[pieceI]
    ,type = board.s.board[pieceI], emptyTile = type === 0 || type >= pieces
    var currentBoard = !reset ? info.currentBoard === -1 || boardI === info.currentBoard : null

    // Clearing pieces
    if (piece && piece.type !== type) {
      board.c.remove(piece.mesh)
      board.c.pieces[pieceI] = null
    }

    if (!emptyTile || board.s.winner) {
      if (!emptyTile) {
        let mesh = main.models[type].clone()
        mesh.position.set(...main.boardPosition(0.5)[pieceI])
        mesh.visible = true
        board.c.pieces[pieceI] = {mesh, type}
        board.c.add(mesh)
      }
      unsetCell(cell)
      cell.won ? color(cell, 'won') : color(cell, 'unset')
    } else if (currentBoard) {
      var targetBoardIsWon = 'winner' in info.game[cell.index]
      ,gameWillWin = false, boardWillWin = false

      function checkWin(winType, start_index, increment, end_index) {
        var indices = [], foundSpot = false
        for (let i = start_index; i <= end_index; i += increment) {
          let index = winType === 'board' ? pieceI : winType === 'game' ? boardI : null
          if (i === index) foundSpot = true
          indices.push(i)
        }
        if (!foundSpot) return false
        var won = true // A winner until proven a loser
        for (let i = 0; i < indices.length; i++) {
          let index = winType === 'board' ? pieceI : winType === 'game' ? boardI : null
          ,winner = (
            winType === 'board' ? info.game[boardI].board[indices[i]] :
            winType === 'game' ? info.game[indices[i]].winner : null
          )
          if (indices[i] === index) winner = info.currentPlayer + 1
          if (winner !== info.currentPlayer + 1) {won = false; break}
        }
        return won
      }

      let boards = 3, board_row = Math.floor(boardI/boards), board_column = boardI % boards
      ,row_size = 3, row = Math.floor(pieceI/row_size), column = pieceI % row_size

      let checks = [
        checkWin('board', row_size*row, 1, row_size*(row+1) - 1)
       ,checkWin('board', column, row_size, column + row_size*(row_size-1))
       ,checkWin('board', 0, row_size + 1, row_size*row_size - 1)
       ,checkWin('board', row_size - 1, row_size - 1, row_size*(row_size-1))
      ]
      boardWillWin = !!checks.filter(c => !!c).length
      var currentBoardWillWin = pieceI === boardI ? boardWillWin : false

      if (boardWillWin) {
        let checks = [
          checkWin('game', boards*board_row, 1, boards*(board_row+1) - 1)
          ,checkWin('game', board_column, boards, board_column + boards*(boards-1))
          ,checkWin('game', 0, boards + 1, boards*boards - 1)
          ,checkWin('game', boards - 1, boards - 1, boards*(boards-1))
        ]
        gameWillWin = !!checks.filter(c => !!c).length
      }

      if (myTurn) {
        // Re-add cell pad to touch events
        if (main.objects.indexOf(cell) === -1) main.objects.push(cell)
        // -f Self Color Coding
        if (gameWillWin) color(cell, 'win')
        else if (targetBoardIsWon || currentBoardWillWin) color(cell, 'warning')
        else color(cell, 'available')
        // --f
      } else {
        // -f Opponent Color Coding
        if (gameWillWin) color(cell, 'opponent_win')
        else if (targetBoardIsWon || currentBoardWillWin) color(cell, 'opponent_warning')
        else color(cell, 'opponent_available')
        // --f
      }

    } else color(cell, 'unset')
  }

  for (let boardI = 0; boardI < game.boards.length; boardI++) {
    var bg = !reset ? game.boardBackgrounds[boardI] : null
    ,s = !reset ? info.game[boardI] : {board: [0,0,0,0,0,0,0,0,0]}
    ,board = {i: boardI, c: game.boards[boardI], bg, s}
    setWinner(board)
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
  main.passes.push(renderPass)
  composer.addPasses(renderPass)
  renderPass.renderToScreen = true

  composer.render()

  main.sizing.push(v => {
    main.canvas.style.width = '0px'
    main.canvas.style.height = '0px'
    document.body.style.height = v.y + 'px'
    renderer.setPixelRatio(devicePixelRatio)
    renderer.setSize(v.x, v.y)
    camera.aspect = v.x / v.y

    camera.updateProjectionMatrix()
    scene.scale.x = scene.scale.z = Math.min(1.29*camera.aspect-0.042,1.2)
    composer.render()
  })
  // --f

  function createText(tag, text, parent) {
    var node = document.createElement(tag).addChildren(document.createTextNode(text), 'textNode')
    if (tag !== 'button') node.addClasses('noselect')
    if (parent) parent.appendChild(node)
    return node
  }

  // -f Load Board + HUD
  var boardPosition = main.boardPosition, sidelength = 320
  ,loadMesh = file => new Promise((resolve, reject) => {
    main.gltfLoader.load(file, obj => resolve(obj.scene.children[0]), null, reject)
  })

  var game = main.game = createBox({s: [sidelength, 20, sidelength], color: 0xdddddd})
  Object.assign(game, {name: 'game', boards: [], boardBackgrounds: [], sidelength})
  scene.add(game)

  loadMesh('board.gltf').then(board => {
    board.scale.x = board.scale.z = 3/10

    var cell = createSquare({s: [100,100], opacity: 0, t: [0,20,0], n: 'cell'})
    var boardBackground = createSquare({s: [100,100], opacity: 0, t: [0,10,0], n: 'boardbg'})

    for (let spotI = 0; spotI < 9; spotI++) {
      cell.position.set(...boardPosition(0.1)[spotI])
      board.add(cell)
      cell = cell.clone()
    }

    for (let boardI = 0; boardI < 9; boardI++) {
      board.index = boardBackground.index = boardI
      board.winPiece = null
      board.pieces = [null, null, null, null, null, null, null, null, null]
      board.position.set(...boardPosition(10)[boardI])
      boardBackground.position.set(...boardPosition(10)[boardI])
      game.boards[boardI] = board
      game.boardBackgrounds[boardI] = boardBackground
      game.add(board, boardBackground)

      board.cells = board.children.slice()
      for (let cellI = 0; cellI < 9; cellI++) {
        let cell = board.cells[cellI]
        cell.index = cellI
        cell.material = cell.material.clone()
        cell.state = {opacity: 0, color: [0,0,0]}
      }

      board = board.clone()
      boardBackground = boardBackground.clone()
      boardBackground.material = boardBackground.material.clone()
    }
    composer.render()
  })

  var hud = main.hud = document.createElement('div').makeChildOf(document.body)
  .setStyle({position: 'absolute', top: 0}).addChildren(
    document.createElement('div'), 'statusDiv',
    document.createElement('div'), 'modalDiv'
  )
  hud.classList.add('nopointer', 'noselect')

  var pageError = query('error')
  if (pageError) {
    if (pageError === 'game_not_found') {
      history.replaceState(null, document.title, base_href + '/game?menu=join')
    }
    main.error = pageError
  }

  main.sizing.push(v => {
    hud.style.width = v.x + 'px'
    hud.style.height = v.y + 'px'
  })
  // --f

  function infoMiddleware(info) {
    if ('error' in info) {
      if (info.error === 'game_not_found') {
        clearInterval(main.refresh)
        hud.status.detach()
        main.sizing.remove(hud.status.sizing)
        main.update.actions = main.update.actions.filter(e => e !== hud.status.update)
        updateGame(null, true)
        state0()
        return
      }
      // return location.href = base_href + '/game?error=' + info.error
      return
    }
    info.isCreator = info.creator === info.self.id

    Object.keys(info.update).map(key => main.update[key] = true)

    return main.info = info
  }
  function onUpdateKey(key, cb) { if (main.update[key]) {
    main.update[key] = null
    cb(main.info)
  } }

  // -f Statusboard
  function makeStatusboard(info) {
    if (hud.status) {
      main.update.actions = main.update.actions.filter(e => e !== main.update.status)
      main.sizing.remove(hud.status.sizing)
      hud.status.detach()
    }
    var status = hud.status = document.createElement('div').makeChildOf(hud.statusDiv)
    .setStyle({right: 0}).addClasses('hud').addChildren(
      document.createElement('div').setStyle({
        paddingTop: '0.5em', paddingBottom: '0.5em', backgroundColor: '#FFF', overflow: 'auto'
      }), 'body'
      ,document.createElement('div').setStyle({
        position: 'relative', right: '1em', width: '1em', backgroundColor: '#888'
      }), 'openButton'
    )

    Object.assign(status, {open: true, params: {w: 200}})
    status.setStyle({width: status.params.w + 'px'})

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

    hud.bottombox = document.createElement('div').makeChildOf(status.body)
    .setStyle({textAlign: 'left'}).addChildren(
      createText('button', 'Chat'), 'chat'
      ,createText('button', 'Settings').setStyle({float: 'right'}), 'settings'
    )

    status.sizing = main.sizing.push(v => {
      var height = v.y, statusStyle = getComputedStyle(status)
      ,statusBodyStyle = getComputedStyle(status.body)

      if (main.info) {
        var scroll = status.body.scrollTop
        status.body.style.height = 'auto'
        let computedHeight = parseFloat(statusBodyStyle.height)
        if (computedHeight) height = Math.min(computedHeight, v.y)
        status.body.style.height = height + 1 + 'px'
        status.body.scrollTop = scroll
      }

      status.openButton.setStyle({bottom:statusBodyStyle.height,height:statusBodyStyle.height})

      if (!status.animated) {
        status.animated = true

        let right = parseFloat(statusStyle.right)
        ,final = !status.open * -status.params.w
        ,step = (final - right) / 10, direction = Math.sign(step)

        animate(() => {
          right += step
          status.style.right = right + 'px'
          if (direction*right < direction*final) return true
          else return status.animated = false
        })
      }
    })

    function updateStatus(info) {
      onUpdateKey('players', () => {
        let {playerlist} = hud
        while (playerlist.table.children.length > 1) {
          playerlist.table.children[1].detach()
        }
        info.players.map(player => {
          var playerListing = document.createElement('tr').makeChildOf(playerlist.table)
          ;[player.name, player.wins, info.players.indexOf(player)+1]
          .map(e => createText('td', e, playerListing))
        })
        playerlist.viewers.count.data = info.viewers.length
        main.sizing.resize()
        if (hud.modal && hud.modal.playerCount) {
          hud.modal.playerCount.innerText = info.players.length + '/2'
        }
      })
      onUpdateKey('turn', () => {
        let {table} = hud.playerlist
        for (let i = 0; i < table.children.length; i++) {
          if (i === info.currentPlayer + 1) table.children[i].style.backgroundColor = '#DDF'
          else table.children[i].style.backgroundColor = ''
        }
      })
      onUpdateKey('gameCount', () => {
        let {infobox} = hud
        infobox.games.count.data = info.games || 0
        infobox.draws.count.data = info.draws || 0
      })
    }
    main.update.status = updateStatus
    main.update.actions.push(updateStatus)

    eventListeners(status.body, {
      touchstart: [event => {
        var touch = event.touches[0]
        status.mouse = {y: touch.clientY}
      }, {passive: true}]
      ,touchmove: [event => {
        var touch = event.touches[0], mouse = {y: touch.clientY}
        status.body.scrollTop -= mouse.y-status.mouse.y
        status.mouse = mouse
      }, {passive: true}]
    })

    function useOpenButton(event) {
      status.open = !status.open
      main.sizing.resize()
    }
    eventListeners(status.openButton, {mouseup: useOpenButton, touchend: useOpenButton})
  }
  // --f

  // -f Modal
  function createModal(opt) {
    if (hud.modal) {
      main.sizing.remove(hud.modal.sizing)
      hud.modal.detach()
    }
    if (typeof opt !== 'object') opt = {}
    opt = Object.assign({animated: true}, opt)

    var modal = hud.modal = document.createElement('div')
    modal.params = {_width: [opt.width || 250], _height: [0]}
    Object.assign(modal.params._width, {squish: 1, resize: 2})
    Object.assign(modal.params._height, {squish: 1, resize: 2})
    Object.defineProperty(modal.params, 'width', {
      get: function() {return this._width.reduce((a,c)=>a+(parseFloat(c)||0),0)}
    })
    Object.defineProperty(modal.params, 'height', {
      get: function() {return this._height.reduce((a,c)=>a+(parseFloat(c)||0),0)}
    })

    modal.addClasses('hud').setStyle({
      color: '#FFF', width: modal.params.width + 'px', top: 0, backgroundColor: '#445'
      ,borderRadius: '5px', minHeight: '2em'
    }).addChildren(
      document.createElement('div'), 'body'
      ,document.createElement('div').setStyle({margin: '0.5em 0'}).addChildren(
        createText('button', '').setStyle({textAlign: 'center', color: '#DDD'}), 'button'
      ), 'return'
    )

    Object.assign(modal, {
      open: false, sizing: v => {
        var widthArray = modal.params._width
        ,heightArray = modal.params._height
        ,isNewGameMenu = modal.body.menu === modal.menuNewGame

        var heightNoSquish = (
          heightArray.reduce((a,c,i)=>i!==heightArray.squish?a+parseFloat(c):a,0)
        )
        if (heightNoSquish > v.y) {
          widthArray[widthArray.squish] = 100
          heightArray[heightArray.squish] = v.y - heightNoSquish - 10
        } else {
          widthArray[widthArray.squish] = 0
          heightArray[heightArray.squish] = 0
        }

        var style = {
          width: modal.params.width + 'px'
          ,height: modal.params.height + 'px'
          ,left: (v.x - modal.params.width)/2 + 'px'
        }
        if (modal.open) style.top = (v.y - modal.params.height)/2 + 'px'
        modal.setStyle(style)
      }
    })
    main.sizing.push(modal.sizing)

    if (opt.animated) animate(time => {
      var h = parseFloat(getComputedStyle(modal).height) || modal.params.height || 0
      ,pos = parseFloat(modal.style.top) + 10, end = (window.innerHeight-h)/2
      modal.style.top = pos + 'px'
      if (pos < end) {return true} else {
        modal.style.top = end + 'px'
        modal.open = true
      }
    })
    return modal
  }
  var modal = createModal()

  function fadeModal() {
    var opacity_i = 1, opacity = opacity_i, opacity_f = 0
    ,delta = opacity_f - opacity_i, step = delta/10, dir = Math.sign(delta)

    return animate(() => {
      opacity += step
      modal.body.style.opacity = modal.return.style.opacity = opacity
      if (dir*opacity < dir*opacity_f) return true
      else {
        modal.body.style.opacity = modal.return.style.opacity = ''
        return false
      }
    })
  }
  function resizeMenu(key, animated) {
    var obj = {}
    if (key) {
      var height_i = height = parseFloat(getComputedStyle(modal).height)
      ,temp = modal.style.height
      modal.style.height = ''
      modal[key].makeChildOf(modal.body, 'menu')
      var height_f = parseFloat(getComputedStyle(modal).height)
      modal[key].detach()
      modal.style.height = temp
      modal.body.style.display = modal.return.style.display = 'none'
    } else {
      var temp = modal.style.height
      var height_i = height = parseFloat(getComputedStyle(modal).height)
      modal.style.height = ''
      var height_f = parseFloat(getComputedStyle(modal).height)
      modal.style.height = temp
    }

    var delta = height_f - height_i, step = delta/10, dir = Math.sign(delta)
    ,heightArray = modal.params._height

    function finishResize() {
      if (key) modal.body.style.display = modal.return.style.display = ''
      heightArray[heightArray.resize] = height_f + 'px'
      if (key) modal[key].makeChildOf(modal.body, 'menu')
      main.sizing.resize()
    }
    if (animated) {
      animate(() => {
        height += step
        heightArray[heightArray.resize] = height + 'px'
        main.sizing.resize()
        if (dir*height < dir*height_f) return true
        else finishResize()
      })
    } else finishResize()
  }
  // --f

  // -f State 0 -- Creation
  function state0() {
    var dom = {}, inputs = {}, key

    main.info = main.info || {}
    main.info.self = main.info.self || self_token

    modal.makeChildOf(hud.modalDiv)

    modal.return.button.removeEventListener('click', modal.return.button.closeGame)
    modal.return.button.removeEventListener('touchend', modal.return.button.closeGame)
    modal.return.button.removeEventListener('click', modal.return.button.buttonReturn)
    modal.return.button.removeEventListener('touchend', modal.return.button.buttonReturn)
    function buttonReturn(event) {
      if (event.target === modal.return.button) {
        if (modal.return.action === 'return') location.href = base_href + '/'
        else if (modal.return.action === 'back') {
          modal.return.button.blur()
          mainMenu()
          main.sizing.resize()
        }
      }
    }
    modal.return.button.buttonReturn = buttonReturn
    eventListeners(modal.return.button, {click: buttonReturn, touchend: buttonReturn})

    function menuNewGame() {
      function createMenu() {
        let menu = modal.menuNewGame = document.createElement('div')
        .setStyle({marginTop: '0.5em', height: 'auto'})
        .addChildren(createText('div','New Game Settings'))
        ,radio_state = {pieces_host: true, pieces_players: false}
        ,radioAttributes = (name,type) => ['type','radio','name',name,'id',type,'value',type]

        // -f Name Field
        key = 'opt_name'
        ,skip = document.createElement('div')
        .setStyle({display: 'flex', justifyContent: 'flex-end', marginTop: '0.5em'})
        .addChildren(createText('div','Optional: Add a name').setStyle({fontSize:'0.7em'}),'label')

        dom.name = document.createElement('div').makeChildOf(menu, key)
        .setStyle({backgroundColor: '#556', padding: '0.5em', marginTop: '0.5em'})
        .addChildren(
          document.createElement('div').setStyle({display: 'flex'}).addChildren(
            inputs.name = document.createElement('input').setStyle({width: 0, flex: 1})
            .setAttributes('id','name','placeholder','Game Name')
          )
          ,skip
        )

        inputs.name.addEventListener('touchstart', event => inputs.name.focus(), {passive: true})
        inputs.name.addEventListener('keydown', event => {
          setTimeout(() => {
            if (!(inputs.name.value)) {
              skip.label.innerText = 'Skipping name'
              skip.style.visibility = ''
            } else if (inputs.name.value) {
              skip.style.visibility = 'hidden'
            }
          }, 50)
        })
        // --f
        // -f Join As Player
        key = 'opt_join'
        inputs[key] = []
        document.createElement('div').makeChildOf(menu, key).setStyle({
          backgroundColor: '#556', padding: '0.25em 0', display: 'flex', marginTop: '0.2em'
          ,justifyContent: 'center'
        }).addChildren(
          inputs[key][0] = document.createElement('input')
          .setAttributes('type','checkbox','id',key)
          ,dom.joinLabel = createText('label', 'Joining this Game?').setAttributes('for', key)
          .setStyle({marginLeft: '0.5em'})
        )

        inputs[key][0].addEventListener('touchstart', () => inputs[key][0].click(), {passive: true})
        dom.joinLabel.addEventListener('touchstart', () => inputs[key][0].click(), {passive: true})
        // --f
        // -f Piece Select Field
        // key = 'opt_piece'
        // let pieceAttributes = type => radioAttributes(key, type)
        // inputs[key] = []
        // document.createElement('div').makeChildOf(menu, key)
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
        // document.createElement('div').makeChildOf(menu, key)
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

        function setCreateButton() {
          dom.create = createText('button','Create').setStyle({textAlign: 'center'})
          .addClasses('menuButton').makeChildOf(menu)

          function useCreateButton(event) {
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

            ws.emit('create', values, info => {
              ws.emit('log', info)
              if (info && 'error' in info) return console.error(info)
              infoMiddleware(info)

              var newTitle = info.name || 'NoughtAxys Game'
              history.replaceState(null, newTitle, base_href + '/game?id=' + info._id)
              document.title = newTitle

              var returnButton = modal.return.button
              returnButton.removeEventListener('click', returnButton.buttonReturn)
              returnButton.removeEventListener('touchend', returnButton.buttonReturn)
              modal.body.menu.detach()

              main.id = info._id
              infoInit(info)
            })
          }
          eventListeners(dom.create, {click: useCreateButton, touchend: useCreateButton})
        }
        if (main.info.self.name) setCreateButton()
        else {
          let name = document.createElement('form')
          .setStyle({display: 'flex', margin: '0.5em', justifyContent: 'center'})
          name.makeChildOf(menu).addChildren(
            name.input = document.createElement('input').setStyle({width: 0, flex: 4})
            .setAttributes(
              'id','username','autocomplete','username','placeholder','Enter a username first'
            )
            ,name.button = createText('button', 'Set').makeChildOf(menu)
            .setStyle({backgroundColor: '#556', flex: 1})
          )

          function setName() {
            if (!name.input.value) return console.error('Name required')
            httpRequest('GET', '/setToken?name=' + name.input.value, () => {
              ws.close()
              name.detach()
              setCreateButton()
              resizeMenu('menuNewGame')
            })
          }
          name.input.addEventListener('touchend', event => name.input.select())
          eventListeners(name.button, {click: setName, touchend: setName})
          name.addEventListener('submit', event => event.preventDefault())
        }
      }

      modal.return.button.innerText = 'Back'
      modal.return.button.style.backgroundColor = '#555'
      modal.return.action = 'back'
      if (!modal['menuNewGame']) createMenu()
      resizeMenu('menuNewGame')
    }
    function menuJoinGame() {
      function createMenu() {
        let menu = modal.menuJoinGame = document.createElement('div')
        .setStyle({marginTop: '0.5em'}).addChildren(createText('div','Game Lobby'))
      }

      modal.return.button.innerText = 'Back'
      modal.return.button.style.backgroundColor = '#555'
      modal.return.action = 'back'
      if (!modal['menuJoinGame']) createMenu()
      resizeMenu('menuJoinGame')
    }
    function mainMenu() {
      function createMenu() {
        modal.mainMenu = document.createElement('div').addChildren(
          dom.buttonNew = createText('button', 'Create a New Game').addClasses('menuButton')
          ,dom.buttonJoin = createText('button', 'Join an Existing Game').addClasses('menuButton')
        )

        function clickMenuOption(event) {
          if (event.target === dom.buttonNew) {
            history.replaceState(null, 'New Game - NoughtAxys', base_href + '/game?menu=new')
            document.title = 'New Game - NoughtAxys'
            fadeModal().then(() => {
              modal.body.menu.detach()
              menuNewGame()
            })
          } else if (event.target === dom.buttonJoin) {
            history.replaceState(null, 'Join Game - NoughtAxys', base_href + '/game?menu=join')
            document.title = 'Join Game - NoughtAxys'
            fadeModal().then(() => {
              modal.body.menu.detach()
              menuJoinGame()
            })
          }
        }
        eventListeners(modal.mainMenu, {click: clickMenuOption, touchend: clickMenuOption})
      }

      history.replaceState(null, 'Menu - NoughtAxys', base_href + '/game')
      document.title = 'Menu - NoughtAxys'
      fadeModal().then(() => {
        if (modal.body.menu) modal.body.menu.detach()
        modal.return.button.innerText = 'Return to Home Page'
        modal.return.button.style.backgroundColor = '#544'
        modal.return.action = 'return'
        if (!modal['mainMenu']) createMenu()
        resizeMenu('mainMenu')
      })
    }

    var menuType = query('menu')
    if (menuType === 'new') menuNewGame()
    else if (menuType === 'join') menuJoinGame()
    else mainMenu()
  }
  // --f

  // -f State 1 -- Open Lobby
  function state1(info) {
    // -f Modal
    var dom = {}

    modal.makeChildOf(hud.modalDiv)

    function createMenu() {
      var menu = modal.menuWaiting = document.createElement('div')
      // Waiting for Players
      // -f Regular Player
      if (!info.isCreator) {
        document.createElement('div').makeChildOf(menu)
        .setStyle({width: '100%', padding: '0.5em', backgroundColor: '#334', marginTop: '0.5em'})
        .addChildren(
          createText('div', 'Waiting for players to join...')
          ,modal.playerCount = createText('div', info.players.length + '/2')
          .setStyle({marginTop: '0.5em'})
        )
      }
      // --f
      // -f Game Host
      else {
        createText('div', 'Invite players or viewers with the link below').makeChildOf(menu)
        .setStyle({margin: '0.5em', fontFamily: 'monospace'})

        document.createElement('div').makeChildOf(menu).setStyle({
          display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '0.5em'
          ,backgroundColor: '#334', padding: '0.5em'
        }).addChildren(
          modal.boxURL = createText('textarea', location.href)
          .setAttributes('readonly','true','wrap','soft')
          ,dom.copy = document.createElement('button').setStyle({
            width: '1em', height: '1em', padding: '2px'
            ,background: 'url(img/copy.png) center center no-repeat', backgroundSize: '90% 90%'
            ,marginLeft: '0.5em'
          })
        )
        menu.makeChildOf(modal.body)
        modal.boxURL.setStyle({height: modal.boxURL.scrollHeight+2+'px', resize: 'none'})
        menu.detach()

        document.createElement('div').makeChildOf(menu)
        .setStyle({marginTop: '0.5em', backgroundColor: '#334', padding: '0.5em'}).addChildren(
          createText('div','Waiting for players...')
          ,modal.playerCount = createText('div', info.players.length + '/2')
        )

        function copyFn() {
          copyTextToClipboard(modal.boxURL).then(() => {
            document.body.scrollTop = 0
            var rect = dom.copy.getBoundingClientRect()
            var tooltip = document.createElement('div').makeChildOf(hud).setStyle({
              display: 'flex', justifyContent: 'center', padding: '0.2em'
              ,position: 'absolute', backgroundColor: '#FFF'
              ,top: rect.top - 20 + 'px', left: rect.left - rect.width/2 + 'px'
            }).addChildren(createText('span','Copied').setStyle({fontSize: '0.5em'}))
            setTimeout(() => tooltip.detach(), 1000)
          }).catch(console.error)
        }
        eventListeners(dom.copy, {click: copyFn, touchend: copyFn})
        eventListeners(modal.boxURL, {click: copyFn, touchend: copyFn})
      }
      // --f
    }

    // Button - Close Game
    if (info.isCreator) {
      modal.return.button.innerText = 'Close Game'
      modal.return.action = 'delete'
    } else {
      modal.return.button.innerText = 'Return to Menu'
      modal.return.action = 'back'
    }

    modal.return.button.removeEventListener('click', modal.return.button.closeGame)
    modal.return.button.removeEventListener('touchend', modal.return.button.closeGame)
    function closeGame() {
      if (modal.return.action === 'delete') ws.emit('closegame', main.id)
      clearInterval(main.refresh)
      main.id = null

      main.sizing.remove(hud.status.sizing)
      main.update.actions = []
      hud.status.detach()

      history.replaceState(null, 'Menu - NoughtAxys', base_href + '/game')
      document.title = 'Menu - NoughtAxys'
      state0()
    }
    modal.return.button.closeGame = closeGame
    eventListeners(modal.return.button, {click: closeGame, touchend: closeGame})
    modal.return.button.style.backgroundColor = '#544'

    if (!modal['menuWaiting']) createMenu()
    var menu = modal.menuWaiting
    function togglePlayer() { ws.emit('player', main.id, info => {
      if ('error' in info) return console.error(info)
      infoMiddleware(info)
      updateWaiting(info)
    }) }

    modal.playerCount.innerText = info.players.length + '/2'
    if (modal.boxURL) modal.boxURL.innerText = location.href

    menu.changed = false
    function menuAction(event) {
      var action = event.target.action
      if (action) {
        if (action === 'player') togglePlayer()
        else if (action === 'name') {
          httpRequest('GET', '/setToken?name=' + menu.name.input.value, () => {
            menu.changed = true
            menu.name.detach()
            menu.name = null
            ws.close()
          })
        }
        else if (action === 'start') { ws.emit('start', main.id, info => {
          hud.modal.detach()
        }) }
      }
    }
    eventListeners(menu, {click: menuAction, touchend: menuAction})

    function updateWaiting(info) {
      var isPlayer = info.players.map(player => player.id).indexOf(info.self.id) !== -1
      ,hasName = !!(info.self||{}).name, gameIsFull = info.players.length === 2

      if (info.isCreator && gameIsFull) {
        if (!menu.start) {
          menu.changed = true
          createText('button', 'Start Game').makeChildOf(menu, 'start')
          .setStyle({display: 'block', backgroundColor: '#679', margin: '0.5em auto 0'})
          menu.start.action = 'start'
        }
      } else if (menu.start) {
        menu.changed = true
        menu.start.detach()
        menu.start = null
      }

      if (isPlayer) {
        if (menu.state !== 'player') {
          menu.state = 'player'
          menu.changed = true
          if (menu.result) menu.result.detach()
          menu.result = createText('button', 'Leave Game')
          .setStyle({display: 'block', backgroundColor: '#A55', margin: '0.5em auto 0'})
          menu.result.action = 'player'
        }
      } else if (gameIsFull) {
        if (menu.state !== 'full') {
          menu.state = 'full'
          menu.changed = true
          if (menu.result) menu.result.detach()
          menu.result = createText('div', 'Game currently full.').setStyle({marginTop: '0.5em'})
        }
      } else if (hasName) {
        if (menu.state !== 'join') {
          menu.state = 'join'
          menu.changed = true
          if (menu.result) menu.result.detach()
          menu.result = createText('button', 'Join Game')
          .setStyle({display: 'block', backgroundColor: '#697', margin: '0.5em auto 0'})
          menu.result.action = 'player'
        }
      } else if (menu.result) {
        menu.changed = true
        menu.state = null
        menu.result.detach()
        menu.result = null
      }

      if (!isPlayer && !hasName) {
        if (!menu.name) {
          menu.changed = true
          menu.name = document.createElement('form')
          .setStyle({display: 'flex', padding: '0.5em 0.5em 0'})
          menu.name.addChildren(
            document.createElement('input').setStyle({width: 0, flex: 4})
            .setAttributes('placeholder','Username'), 'input'
            ,menu.name.button = createText('button', 'Set')
            .setStyle({backgroundColor: '#556', flex: 1})
          )
          menu.name.button.action = 'name'
          menu.name.addEventListener('submit', event => event.preventDefault())
        }
      } else if (menu.name) {
        menu.changed = true
        menu.name.detach()
        menu.name = null
      }

      if (menu.changed) {
        menu.changed = false
        function setSection(key) { if (menu[key]) menu[key].makeChildOf(menu) }
        setSection('start')
        setSection('result')
        setSection('name')
        resizeMenu(null, false)
      }
    }
    updateWaiting(info)

    resizeMenu('menuWaiting')

    main.update.waiting = updateWaiting
    main.update.actions.push(updateWaiting)
    // --f

    makeStatusboard(info)
  }
  // --f

  // -f State 2 -- Game
  function state2(info) {
    if (!main.hud.status) makeStatusboard(info)

    var models = info.pieces.map(name => (name ? loadMesh(name+'.gltf').catch(e => null) : null))

    Promise.all(models).then(data => {
      for (let pieceI = 1; pieceI < data.length; pieceI++) {
        data[pieceI].name = info.pieces[pieceI]
      }

      main.models = data
    })

    // -f Events Init
    function resetTarget() {
      if (main.targetCell) {
        var opacity = main.targetCell.state.opacity, color = main.targetCell.state.color
        main.targetCell.material.opacity = opacity
        main.targetCell.material.color = color
        main.targetCell = null
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
          if ('error' in info) {
            console.error(info)
            main.update.game = main.update.turn = true
          }
          infoMiddleware(info)
        })
      }
    }

    main.canvas.unsetHandlers = eventListeners(main.canvas, {
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
      }, {passive: true}]
      ,touchmove: [event => {
        event.clientX = event.touches[0].clientX
        event.clientY = event.touches[0].clientY
        setMouse(event)
        mouseOver()
        mouseTouch()
      }, {passive: true}]
      ,touchend: [event => {
        main.isTouch = true
        touchEnd()
        resetTarget()
        main.mouse = null
      }, {passive: true}]
    })
    // --f

    main.exit = false
    animate(() => {
      if (main.models) onUpdateKey('game', updateGame)
      composer.render()
      return !main.exit ? true : main.exit = false
    })
  }
  // --f

  // -f State 3 -- Aftermath

  // --f

  var states = [state0, state1, state2]

  function infoInit(info) {
    if (!(info && info.state)) return
    main.state = info.state

    try {states[info.state](info)}
    catch (e) {}

    if (!main.id) return console.error('No game ID')
    main.refresh = setInterval(infoLoop, 500)
  }
  function infoLoop() {
    ws.emit('info', main.id, info => {
      infoMiddleware(info)

      // Debug override
      if ('_state' in main) info.state = main._state
      else if (!('state' in info)) return clearInterval(this)

      if (main.init) {
        main.init = false
        ;['game','players','gameCount','turn']
        .map(key => main.update[key] = true)
      }

      // -f Changing States
      if (main.state !== info.state) {
        main.exit = true

        if (main.state === 1 && info.state === 2) {
          if (hud.modal) hud.modal.detach()
          delete hud.modal
          main.update.game = main.update.turn = main.update.players = true
          main.update.actions = main.update.actions.filter(e => e !== main.update.waiting)
          delete main.update.waiting
        }
        if (main.state === 2 && info.state !== 2) {
          main.objects = []
          main.canvas.unsetHandlers()
          if (info.state === 3) {
            main.update.game = main.update.players = true
          }
        }

        try {states[info.state](info)}
        catch (e) {}

        main.state = info.state
      }
      // --f

      // -f State-specific recurring actions
      // --f

      // -f General recurring actions
      main.update.actions.map(action => action(info))
      // --f
    })
  }

  if (main.id) ws.emit('info', main.id, info => {
    infoMiddleware(info)
    infoInit(info)
  })
  else state0()
})()
