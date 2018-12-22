const cookie = require('cookie')
const jwt = require('jsonwebtoken')
const hbs = require('hbs')

const {app, router} = require('./../app')
const formidable = require('./../middleware/formidable')
const token = require('./../middleware/token')
const Game = require('./../db/models/game')

var ss = s => new hbs.SafeString(s)

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Home', token: req.token
  })
})

router.get('/games', (req, res) => {
  if (req.query.id) return res.redirect(`/game?id=${req.query.id}`)
  var opt = {title: 'Games'}

  Game.find({}, (err, docs) => {
    res.render('games', opt)
  })
})

router.get('/viewer', (req, res) => {
  res.render('viewer')
})

router.get('/game', (req, res) => {
  var title = 'Menu'
  if (req.query.menu === 'new') title = 'New Game'
  else if (req.query.menu === 'join') title = 'Join Game'
  function renderPage(id) {res.render('game', {
    title, bodyStyle: 'background-color: #000;', id, token: ss(JSON.stringify(req.token))
  })}

  if (req.query.id) {
    Game.findById(req.query.id, (err, doc) => {
      if (err || !doc) return res.redirect('/game?error=game_not_found')
      title = doc.name || 'Game'
      return renderPage(doc._id.toString())
    })
  } else renderPage('')
})

router.get('/setToken', (req, res) => {
  var promise = Promise.resolve(), queries = {
    name: name => token.set(req.token, {name: name.trim()}).then(newToken => {
      res.cookie(process.env.COOKIE_NAME, newToken, token.cookie)
    })
  }

  Object.keys(req.query).map(key => {
    if (typeof queries[key] === 'function') {
      promise = promise.then(() => queries[key](req.query[key]))
    }
  })
  return promise.then(() => res.redirect('back'))
})
