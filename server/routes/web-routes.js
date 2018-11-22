const {app} = require('./../app')

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home Page'
  })
})

app.get('/name', (req, res) => {
  res.send()
})

app.get('/session', (req, res) => {
  // Creates a new session
  req.session.ref = 'noughtaxys'
  req.session.save(() => {
    res.send()
  })
  // Cannot make changes to a pre-existing session. They will be reverted upon the GET
  // request ending.
})
