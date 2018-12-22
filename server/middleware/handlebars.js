const path = require('path')
const hbs = require('hbs')

const {app, router} = require('./../app')
app.set('view engine', 'hbs')

router.use((req, res, next) => {
  res._render = res.render
  res.render = function (file, options) {
    if (!options) options = {}
    file = file.replace('.hbs','')
    res._render('../template.hbs', Object.assign(options, {
      title_suffix:' - NoughtAxys',
      partial: () => file, root: process.env.ROOT_ROUTE, ws: process.env.WS_URL,
      three: process.env.THREE_FILE
    }))
  }
  next()
})

hbs.registerPartials(path.join(__dirname + '/../views/'))
hbs.registerPartials(path.join(__dirname + './../views/partials'))
