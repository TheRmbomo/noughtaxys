const path = require('path')
const fs = require('fs')
const cookie = require('cookie')

const ws = require('./websockets-init')
const {redisClient} = require('./middleware/session')

ws.on('ready', (socket, httpReq) => {
  socket.on('log', (req, send) => {
    console.log(req)
  })

  socket.on('init', (req, send) => {
    socket.getSession((err, session) => {
      if (!session) return send({session: false})
      send({
        ended: false
        ,game: [
          {board: [0,0,0,0,0,0,0,0,0]}
          ,{board: [0,1,0,0,1,0,2,1,0], winner: 1, win: [1,4,7]}
          ,{board: [1,0,0,0,0,0,0,2,0]}
          ,{board: [0,0,0,0,2,0,0,0,0]}
          ,{board: [0,1,0,0,0,0,1,1,0]}
          ,{board: [2,0,0,0,2,0,0,0,2], winner: 2, win: [0,4,8]}
          ,{board: [0,1,2,0,0,1,0,0,0]}
          ,{board: [0,0,0,0,0,0,0,1,0]}
          ,{board: [0,1,0,0,0,2,0,0,0]}
        ]
        ,pieces: [null, 'cross', 'circle']
        ,players: [
          {name: 'Justin', wins: 1, piece: 1},
          {name: 'Hagan', wins: 0, piece: 2}
        ]
        ,viewers: [
          {name: 'Paul'},
          {name: 'Jeremy'}
        ]
        ,games: 2, draws: 1
        ,currentPlayer: 1, currentBoard: -1, winner: null, win: null
      })
    })
  })

  socket.on('session', (req, send) => {
    if (!req.name) return send({required: 'name'})
    socket.getSession((err, session, save) => {
      if (err) return console.log(new Error(err))
      if (!session) return
      session.name = req.name
      save(session)
      send(true)
    })
  })

  socket.on('move', (req, send) => {

  })
})
