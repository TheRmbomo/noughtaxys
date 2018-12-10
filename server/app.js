// Environment Variables
require('./config/config')
// --

// External Libraries
const path = require('path')
const http = require('http')
const express = require('express')
// --

// Local Libraries
const token = require('./middleware/token')
// --

// Local Constants
const public = path.join(__dirname + '/../public')
const httpPort = process.env.PORT
// --

// App Initialization
var app = express()
.set('views', path.join(__dirname + '/views'))

Object.assign(app.locals, {
  title_suffix: '',
  title: ''
})

var httpServer = http.createServer(app)

var router = express.Router()
.use(express.static(public))
.use(token.get)
app.use(process.env.ROOT_ROUTE, router)

module.exports = {app, router, httpServer}
// --

// Databases
require('./db/mongoose')
// --

// Middleware
require('./middleware/handlebars')
// --

// Routes
require('./websockets')
require('./routes/web-routes')
// --

// Default Routes
router.get('/not-found', (req, res) => {
  res.send('Resource not found.')
})

router.all('*', (req, res) => {
  res.redirect('/not-found')
})
// --

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Server is up on port ${httpPort}`))
