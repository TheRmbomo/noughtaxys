const path = require('path')
const fs = require('fs')
const cookie = require('cookie')

const ws = require('./websockets-init')

ws.on('ready', (socket, httpReq) => {
  socket.on('log', (req, send) => {
    console.log(req)
  })

  socket.on('init', (req, send) => {
    send({
      game: [
        [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,1], [0,0,2,0,0,0,0,0,0]
      ]
      ,players: [
        {name: 'Justin', wins: 1, piece: 1},
        {name: 'Hagan', wins: 0, piece: 2}
      ]
      ,viewers: [
        {name: 'Paul'},
        {name: 'Jeremy'}
      ]
      ,games: 2, draws: 1
    })
  })
})
