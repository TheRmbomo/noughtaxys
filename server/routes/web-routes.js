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
    title: 'NoughtAxys - Home', token: req.token
  })
})

router.get('/games', (req, res) => {
  if (req.query.id) return res.redirect(`/game?id=${req.query.id}`)
  var opt = {title: 'NoughtAxys - Games'}

  Game.find({}, (err, docs) => {
    res.render('games', opt)
  })
})

router.get('/viewer', (req, res) => {
  res.render('viewer')
})

router.post('/newgame', (req, res) => {
  if (!req.token.name) return res.status(400).redirect('/?name=required')

  var game = new Game({creator: req.token.id})
  return game.save((err, doc) => {
    if (err) {
      console.error(err)
      return res.status(500).json({error: 'Server Error'})
    }
    return res.redirect(`/game?id=${game._id}`)
  })
})

router.get('/game', (req, res) => {
  console.log(req.token)
  if (!req.query.id) return res.redirect('/games')
  return Game.findById(req.query.id, (err, doc) => {
    if (err || !doc) return res.redirect('/')
    else return res.render('game', {
      title: `Game Title`, bodyStyle: 'background-color: #000;', id: req.query.id
    })
  })
})

router.get('/setToken', (req, res) => {
  console.log(req.query)
  var promise = Promise.resolve(), queries = {
    name: name => {
      promise = promise.then(() => token.set(req.token, {name: name.trim()}).then(newToken => {
        res.cookie(process.env.COOKIE_NAME, newToken, token.cookie)
      }))
    }
  }

  Object.keys(req.query).map(key => {
    if (typeof queries[key] === 'function') queries[key](req.query[key])
  })
  return promise.then(() => res.redirect('back'))
})
