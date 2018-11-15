const express = require('express')
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const redisClient = new RedisStore({
  host: 'www.axysmundi.com', port: 6379, pass: process.env.REDIS
})
module.exports.redisClient = redisClient

const {app} = require('./../app')
const Game = require('./../db/models/game')

app.use(session({
  store: redisClient,
  resave: false, saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  name: process.env.COOKIE_NAME + '.sid',
  cookie: {maxAge: 1000 * 60 * 60 * 24 * 365, secure: process.env.COOKIE_SECURE}
}))
.use((err, req, res, next) => {
  console.log('err', err)
  if (err) return next()
})
