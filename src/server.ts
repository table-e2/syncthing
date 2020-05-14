import express from 'express'
import handlebars from 'express-handlebars'
import expressFormidable from 'express-formidable'
import * as utils from './server/utils'
import { SessionData } from './server/sessionData'

const app = express()
app.engine('handlebars', handlebars())
app.set('view engine', 'handlebars')

app.use(utils.logger)
app.use(expressFormidable())

app.listen(utils.port, () => {
    if (utils.devMode) {
        utils.logInfo('Server started in dev mode')
        utils.logInfo(`Available at http://127.0.0.1:${utils.port}`)
    } else {
        utils.logInfo('Server started')
    }
})

// landing page
app.get('/', (_req, resp) => {
    resp.render('home')
})

// Any static files
app.use('/static', express.static('static'))

// JS files
app.use('/js', express.static('dist'))
if (utils.devMode) {
    // Also serve TS files when in dev so they show up in browser
    app.use('/src', express.static('src'))
}

const sessionData = new SessionData()
// Posts to the api (for new videos)
app.post('/api/:type', (req, resp) => {
    utils.logPostInfo(req.params.type, req.fields, req.files)
    if (req.fields === undefined) {
        utils.logInfo('No data was posted')
        resp.sendStatus(400)
        return
    }
    const fields = req.fields
    if (
        !('username' in fields && 'url' in fields && 'password' in fields && 'control_key' in fields) ||
        typeof fields.username !== 'string' ||
        typeof fields.url !== 'string' ||
        typeof fields.password !== 'string' ||
        typeof fields.control_key !== 'string'
    ) {
        utils.logInfo('Wrong data was posted')
        resp.sendStatus(400)
        return
    }
    const userId = sessionData.addUser(fields.username)
    const sessionId = sessionData.addSession(fields.url, fields.password, fields.control_key)
    utils.logDebug(`Create user id ${userId}`)
    resp.redirect(`/watch/${sessionId}`)
})
