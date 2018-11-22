const jwt = require('jsonwebtoken')

const {app} = require('./../app')

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home Page'
  })
})

app.get('/token', (req, res) => {
  // Creates a new token
  var promise = Promise.resolve('')
  if (req.query.name) {
    promise = promise.then(() => new Promise((resolve, reject) => {
      var payload = {name: req.query.name.trim()}, opts = {expiresIn: '7d'}
      jwt.sign(payload, process.env.JWT_SECRET, opts, (err, token) => {
        if (err) return reject(err)
        resolve(token)
      })
    })).catch(e => '')
  }
  promise = promise.then(cookie => {
    res.cookie(process.env.COOKIE_NAME, cookie, {
      maxAge: 1000 * 60 * 60 * 24 * 7, secure: process.env.COOKIE_SECURE === 'true',
      httpOnly: true
    })
    res.send()
  })
//   req.session.ref = 'noughtaxys'
//   req.session.save(() => {
//     res.send()
//   })
//   // Cannot make changes to a pre-existing session. They will be reverted upon the GET
//   // request ending.
})
