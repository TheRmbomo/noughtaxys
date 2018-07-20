const {app} = require('./../app')

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home Page'
  })
})
