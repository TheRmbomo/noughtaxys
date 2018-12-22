const jwt = require('jsonwebtoken')

const ws = require('./websockets-init')
const Game = require('./db/models/game')

var viewing = {}, userSockets = {}

// setInterval(function () {
//   var obj = {}
//   Object.keys(viewing).map(key => {
//     obj[key] = viewing[key].length
//   })
// }, 2000)

function pickFrom(obj, keys) {
  var newObj = {}
  Object.values(keys).map(key => newObj[key] = obj[key])
  return newObj
}

function alias(n) {
  try {return Game.schema.aliases[n]}
  catch (e) {console.error(e)}
}

ws.on('ready', (socket, httpReq) => {
  if (!socket.token) return socket.send('refresh')
  var userid = socket.token.id
  socket.update = {}
  socket.queue = Promise.resolve()

  socket.on('log', console.log)

  socket.on('token', send => send(socket.token))

  socket.on('home', send => {
    return Game.find({[alias('state')]: {$gt: 0}}, (err, docs) => {
      if (err) return send({error: 'server_error'})

      return send({currentGames: docs.length})
    })
  })
  socket.on('games', send => {
    return Game.find({[alias('state')]: {$gt: 0}}, (err, docs) => {
      return send(docs.map(doc => info(doc, ['_id','name','players','viewers'])))
    })
  })

  function info(doc, keys) {
    var data = {self: socket.token, update: {}}
    var stateKeys = [
      ['name','creator','state','players','viewers']
      ,[
        'name','creator','state','players','viewers','pieces','currentBoard','currentPlayer'
        ,'game'
      ]
      ,[
        'name','creator','state','players','viewers','games','draws','winner','win','game'
      ]
    ]
    ,obj = pickFrom(doc, keys || stateKeys[doc.state-1] || ['creator','state'])
    if ('game' in obj) obj.game = obj.game.map(p => pickFrom(p, ['board','winner','win']))
    if ('players' in obj) obj.players = obj.players.map(p => pickFrom(p, ['id','name','wins']))
    Object.keys(socket.update).map(key => {
      data.update[key] = true
      delete socket.update[key]
    })
    return Object.assign(obj, data)
  }
  socket.on('info', (id, send) => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      socket.viewing = doc
      if (!viewing[id]) viewing[id] = []
      if (!userSockets[userid]) userSockets[userid] = []
      if (viewing[id].indexOf(socket) === -1) viewing[id].push(socket)
      if (userSockets[userid].indexOf(socket) === -1) userSockets[userid].push(socket)
      return send(info(doc))
    })
  })

  socket.on('create', (values, send) => {
    if (!socket.token.name) return send({error: 'name_required'})
    return Game.find({[alias('creator')]: userid}, (err, docs) => {
      if (docs.length > 2) return send({error: 'host_of_too_many_games'})
      var game = new Game({creator: userid})
      Object.assign(game, {
        state: 1, name: values.name, visibility: values.opt_vis === 'public'
      })
      if (values.opt_join) {
        game.players.push(socket.token)
        game.markModified('players')
      }
      return game.save((err, doc) => {
        if (err || !doc) return send({error: 'server_error'})
        return send(info(doc, ['_id','name','creator','state','players','viewers']))
      })
    })
  })

  socket.on('player', (id, send) => {
    socket.queue = socket.queue.then(() => send).then(send => new Promise(resolve => {
      return Game.findById(id, (err, doc) => {
        resolve()
        if (err || !doc) return send({error: 'game_not_found'})
        var playerIndex = doc.players.map(player => player.id).indexOf(userid)
        if (playerIndex !== -1) {
          doc.players.splice(playerIndex, 1)
        } else {
          if (!socket.token.name) return send({error: 'missing_name'})
          else if (doc.players.length === 2) return send({error: 'full_game'})
          doc.players.push(socket.token)
          doc.markModified('players')
        }
        return doc.save((err, doc) => {
          if (err) return send({error: 'server_error'})
          else if (!doc) return send({error: 'game_not_found'})
          var id = doc._id.toString()
          if (viewing[id]) viewing[id].map(socket => socket.update.players = true)
          return send(info(doc), {players: true})
        })
      })
    }))
  })

  socket.on('start', (id, send) => {
    Game.findById(id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      if (doc.creator !== userid) return send({error: 'invalid_authentication'})
      if (doc.state === 2) return send({error: 'game_already_started'})
      else if (doc.state !== 1) return send({error: 'invalid_game_state'})
      if (doc.players.length < 2) return send({error: 'not_enough_players'})
      doc.state = 2
      doc.save((err, doc) => {
        if (err || !doc) return send({error: 'server_error'})
        send(info(doc))
      })
    })
  })

  socket.on('move', (req, send) => {
    return Game.findById(req.id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      var currentPlayer = doc.players[doc.currentPlayer], playerIds = doc.players.map(p => p.id)
      if (playerIds.indexOf(socket.token.id) === -1) return send({error: 'not_a_player'})
      else if (currentPlayer.id !== socket.token.id) return send({error: 'wait_your_turn'})

      var board = req.move[0], spot = req.move[1]
      ,boardIsWon = alias('win') in doc.game[board].toObject()
      if (boardIsWon) return send({error: 'board_already_won'})
      else if (doc.game[board].board[spot] !== 0) return send({error: 'invalid_move'})

      doc.game[board].board[spot] = doc.currentPlayer + 1 // Player i:0 is cross i:1
      doc.markModified(`g.${board}.b`)

      function takeUniqueValues(value, index, self) {return self.indexOf(value) === index}
      function checkWin(winType, start_index, increment, end_index) {
        var indices = [], foundItem = false
        for (let i = start_index; i <= end_index; i += increment) {
          let index = winType === 'board' ? spot : winType === 'game' ? board : null
          if (i === index) foundItem = true
          indices.push(i)
        }
        if (!foundItem) return false
        var won = true // A winner until proven a loser
        for (let i = 0; i < indices.length; i++) {
          let winner = (
            winType === 'board' ? doc.game[board].board[indices[i]] :
            winType === 'game' ? doc.game[indices[i]].winner : null
          )
          if (winner !== doc.currentPlayer + 1) {won = false; break}
        }
        if (won) return indices
        else return false
      }

      var emptyTiles = doc.game[board].board.filter(n => n === 0).length
      if (emptyTiles <= 6) {
        // Win checking
        // Row_size added for future dynamic options
        let row_size = 3, row = Math.floor(spot/row_size), column = spot % row_size
        let checks = [
           checkWin('board', row_size*row, 1, row_size*(row+1) - 1)
          ,checkWin('board', column, row_size, column + row_size*(row_size-1))
          ,checkWin('board', 0, row_size + 1, row_size*row_size - 1)
          ,checkWin('board', row_size - 1, row_size - 1, row_size*(row_size-1))
        ]

        let result = checks.reduce((result, check) => {
          if (check) {
            result.won = true
            result.indices = result.indices.concat(check)
          }
          return result
        }, {indices: [], won: false})
        result.indices = result.indices.filter(takeUniqueValues)

        if (result.won) {
          doc.game[board].winner = doc.currentPlayer + 1
          doc.game[board].win = result.indices
          doc.markModified(`g.${board}`)
          checkGameWin()
        }
      }
      function checkGameWin() {
        var wonBoards = doc.game.filter(b => alias('win') in b.toObject()).length
        if (wonBoards >= 3) {
          let boards = 3, row = Math.floor(board/boards), column = board % boards
          let checks = [
             checkWin('game', boards*row, 1, boards*(row+1) - 1)
            ,checkWin('game', column, boards, column + boards*(boards-1))
            ,checkWin('game', 0, boards + 1, boards*boards - 1)
            ,checkWin('game', boards - 1, boards - 1, boards*(boards-1))
          ]
          let result = checks.reduce((result, check) => {
            if (check) {
              result.won = true
              result.indices = result.indices.concat(check)
            }
            return result
          }, {indices: [], won: false})
          if (result.won) {
            doc.players[doc.currentPlayer].wins++
            doc.markModified(`p.${doc.currentPlayer}.wins`)
            doc.games++
            doc.winner = doc.currentPlayer
            doc.win = result.indices
            doc.state = 3
          }
        }
      }

      if (!(alias('win') in doc.game.toObject())) {
        doc.currentPlayer = (doc.currentPlayer + 1) % doc.players.length
        var targetBoardIsWon = alias('win') in doc.game[spot].toObject()
        if (!targetBoardIsWon) doc.currentBoard = spot
        else doc.currentBoard = -1
      }

      return doc.save((err, doc) => {
        if (err || !doc) return send({error: 'server_error'})
        if (viewing[doc._id.toString()]) {
          viewing[doc._id.toString()].map(socket => {
            socket.update.game = socket.update.turn = true
          })
        }
        return send(info(doc))
      })
    })
  })

  socket.on('closegame', id => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc || doc.creator !== userid) return
      return doc.remove(err => null)
    })
  })

  socket.on('close', () => {
    if (!socket.viewing) return
    var id = socket.viewing._id.toString()
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return
      try {
        var viewerIndex = viewing[id].indexOf(socket)
        ,userIndex = userSockets[userid].indexOf(socket)

        if (viewerIndex !== -1) {
          viewing[id].splice(viewerIndex, 1)
          if (viewing[id].length < 1) delete viewing[id]
        }
        if (userIndex !== -1) {
          userSockets[userid].splice(userIndex, 1)
          if (userSockets[userid].length < 1) delete userSockets[userid]
        }
      } catch (e) {console.error(new Error(e))}
      // if (userid === doc.creator && !doc.players.length) return doc.remove()
    })
  })
})
