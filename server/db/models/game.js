const mongoose = require('mongoose')

const Schema = mongoose.Schema

const Game = new Schema({
  n: {type: String, alias: 'name'}
  ,g: {
    type: [{
      _id: false, w: {type: [Number], default: undefined, alias: 'win'}
      ,b: {type: [Number], alias: 'board'}, wr: {type: Number, alias: 'winner'}
    }], alias: 'game'
  }
  ,c: {type: String, alias: 'creator'}
  ,p: {
    type: [{
      _id: false, id: String, n: {type: String, required: true, alias: 'name'},
      w: {type: Number, default: 0, alias: 'wins'}
    }], alias: 'players'
  }, pc: {type: [String], alias: 'pieces'}
  ,v: {
    type: [{
      _id: false, id: String, n: {type: String, required: true, alias: 'name'}
    }], alias: 'viewers'
  }
  ,gN: {type: Number, default: 0, alias: 'games'}
  ,d: {type: Number, default: 0, alias: 'draws'}
  ,cP: {type: Number, default: 0, alias: 'currentPlayer'}
  ,cB: {type: Number, default: -1, alias: 'currentBoard'}
  ,s: {type: Number, default: 1, alias: 'state'}
  ,wr: {type: Number, alias: 'winner'}, w: {type: [Number], default: undefined, alias: 'win'}
  ,vi: {type: Number, default: 1, alias: 'visibility'}
})

Game.pre('save', function () {
  if (this.isNew) {
    for (var i = 0; i < 9; i++) {this.game.push({board: [0,0,0,0,0,0,0,0,0]})}
    this.pieces = this.pieces || []
    this.pieces.push('', 'cross', 'circle')
  }
})

Game.post('save', function () {
})

Game.post('remove', function () {
})

module.exports = mongoose.model('Game', Game, 'Games')
