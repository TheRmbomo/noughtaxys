const mongoose = require('mongoose')

const Game = require('./models/game')

mongoose.Promise = global.Promise
mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true, autoIndex: process.env.MONGOOSE_AUTOINDEX === 'true'
})
.then(r => console.log('Connected to Mongo'))
.catch(e => console.log('Could not connect to Mongo:', e))
