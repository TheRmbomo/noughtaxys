const jwt = require('jsonwebtoken')

const ws = require('./websockets-init')
const timer = require('./timer')
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

ws.on('ready', (socket, httpReq) => {
  var userid = socket.token.id
  socket.on('log', (req, send) => {
    console.log(req)
  })

  socket.on('view', id => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return
      viewing[id] = viewing[id] || []
      userSockets[userid] = userSockets[userid] || []
      socket.viewing = doc
      if (viewing[id].indexOf(socket) === -1) viewing[id].push(socket)
      if (userSockets[userid].indexOf(socket) === -1) userSockets[userid].push(socket)
    })
  })

  socket.on('home', (req, send) => {
    let alias = n => Game.schema.aliases[n]
    return Game.find({[alias('state')]: {$gt: 0}}, (err, docs) => {
      if (err) return send({error: 'server_error'})

      return send({currentGames: docs.length})
    })
  })

  socket.on('games', (req, send) => {
    var opt = {}
    let alias = n => Game.schema.aliases[n]
    return Game.find({[alias('state')]: {$gt: 0}}, (err, docs) => {
      if (docs.length) {
        opt.games = docs.map(doc => {
          doc = pickFrom(doc, ['_id','name','players','viewers'])
          doc.players = doc.players.map(p => pickFrom(p,['id','name','wins']))
          return doc
        })
      }
      return send(opt)
    })
  })

  function info(doc) {
    var obj = {}
    var stateKeys = [
      ['creator','state']
      ,['name','creator','state','players','viewers']
      ,[
        'name','creator','state','players','viewers','pieces','currentBoard','currentPlayer'
        ,'game'
      ]
    ]
    obj = pickFrom(doc, stateKeys[doc.state] || ['creator','state'])
    if ('game' in obj) obj.game = obj.game.map(p => pickFrom(p, ['board','winner']))
    return Object.assign(obj, {self: socket.token})
  }

  socket.on('info', (id, send) => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found', game: false})
      return send(info(doc))
    })
  })

  socket.on('create', (req, send) => {
    return Game.findById(req.id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      if (doc.creator !== socket.token.id) return send({error: 'invalid_authentication'})
      delete req.id
      var {values} = req
      Object.assign(doc, {
        state: 1, name: values.name, visibility: values.opt_vis === 'public'
      })
      if (values.opt_join) {
        doc.players.push(socket.token)
        doc.markModified('players')
      }
      return doc.save((err, doc) => {
        if (err || !doc) return send({error: 'game_not_found'})
        return send(info(doc))
      })
    })
  })

  socket.on('player', (id, send) => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      var playerIndex = doc.players.map(player => player.id).indexOf(socket.token.id)
      if (playerIndex !== -1) doc.players.splice(playerIndex, 1)
      else {
        if (!socket.token.name) return send({error: 'missing_name'})
        doc.players.push(socket.token)
        doc.markModified('players')
      }
      return doc.save((err, doc) => {
        if (err) return send({error: 'server_error'})
        else if (!doc) return send({error: 'game_not_found'})
        return send(info(doc), {players: true})
      })
    })
  })

  socket.on('move', (req, send) => {
    return Game.findById(req.id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      var currentPlayer = doc.players[doc.currentPlayer]
      if (currentPlayer.id !== socket.token.id) return send({error: 'Not your move'})
      var board = req.move[0], spot = req.move[1]
      doc.game[board].board[spot] = doc.currentPlayer + 1
      doc.markModified(`g.${board}.b`)
      doc.currentPlayer = (doc.currentPlayer + 1) % doc.players.length
      return doc.save((err, doc) => {
        if (err) return send({error: 'server_error'})
        else if (!doc) return send({error: 'game_not_found'})
        return send(info(doc))
      })
    })
  })

  socket.on('closegame', (id, send) => {
    return Game.findById(id, (err, doc) => {
      if (err || !doc) return send({error: 'game_not_found'})
      if (doc.creator !== socket.token.id) return send({error: 'invalid_authentication'})
      return doc.remove()
    })
  })

  socket.on('close', () => {
    if (!socket.viewing) return
    var id = socket.viewing._id.toString()
    return Game.findById(socket.viewing._id, (err, doc) => {
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
      if (doc.state === 0) return doc.remove()
      // if (socket.token.id === doc.creator && !doc.players.length) return doc.remove()
    })
  })
})
