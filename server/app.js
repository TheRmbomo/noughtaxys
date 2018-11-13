// Environment Variables
// --

// External Libraries
const path = require('path')
const http = require('http')
const express = require('express')
// --

// Local Constants
const public = path.join(__dirname + '/../public')
const httpPort = 3001
// --

// App Initialization
var app = express()
.set('views', path.join(__dirname + '/views'))
.use(express.static(public))

Object.assign(app.locals, {
  title_suffix: '',
  title: '',
  project_dir: path.join(__dirname, '..'),
  public_dir: public
})

var httpServer = http.createServer(app)
module.exports = {app, httpServer}
// --

// Databases
// --

// Middleware
require('./middleware/handlebars')
// --

// Routes
require('./websockets')
require('./routes/web-routes')
// --

// Default Routes
app.get('/not-found', (req, res) => {
  res.send('Resource not found.')
})

app.all('*', (req, res) => {
  res.redirect('/not-found')
})
// --

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Server is up on port ${httpPort}`))
