const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Game = new Schema({
  players: [{
    _id: String,
    name: String,
    wins: {type: Number, default: 0}
  }]
  ,games: {type: Number, default: 0}
  ,draws: {type: Number, default: 0}
  ,currentPlayer: {type: Number, default: 0}
  ,currentBoard: {type: Number, default: -1}
  // 0: None, 1: Cross, 2: Circle
  ,boards: [{values: [Number], winner: Number, win: Schema.Types.Mixed, _id: false}]
  ,ended: {type: Boolean, default: false}
  ,winner: Number, win: Schema.Types.Mixed
})

Game.pre('save', function () {
  if (this.isNew) {
    var empty_board = {board: [0,0,0,0,0,0,0,0,0]}
    for (var i = 0; i < 9; i++) {this.game.push(empty_board)}
    // this.players.push({
    //   _id: '',
    //   name: 'Player 1'
    // }
    // ,{
    //   _id: '',
    //   name: 'Player 2'
    // })
  }
})

Game.post('save', function () {
  if (!this.players.length) {
    this.remove()
  }
})

Game.post('remove', function () {
})

module.exports = mongoose.model('Game', Game, 'Games')
