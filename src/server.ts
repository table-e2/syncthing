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
        console.info('Server started in dev mode')
        console.info(`Available at http://127.0.0.1:${utils.port}`)
    } else {
        console.info('Server started')
    }
})

// landing page
app.get('/', (_req, resp) => {
    resp.render('home')
})

// Watch page
app.get('/watch/:sessionId', (req, resp) => {
    resp.render('watch', {
        sessionIdUrl: sessionData.getSessionUrl(req.params.sessionId),
        sessionIdTitle: sessionData.getSessionTitle(req.params.sessionId)
    })
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
    const fields = req.fields
    try {
        if (fields === undefined) {
            console.info('No data was posted')
            throw new Error()
        }
        if (utils.hasMembers(fields, ['username', 'title', 'url', 'password', 'controlKey'], 'string')) {
            console.info('Wrong data was posted')
            throw new Error()
        }
    } catch (_err) {
        resp.sendStatus(400)
        return
    }

    const userId = sessionData.addUser(fields.username as string)
    const sessionId = sessionData.addSession(
        fields.url as string,
        fields.title as string,
        fields.password as string,
        fields.controlKey as string
    )
    console.debug(`Create user id ${userId}`)
    resp.redirect(`/watch/${sessionId}`)
})
