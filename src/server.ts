import express from 'express'
import handlebars from 'express-handlebars'
import expressFormidable from 'express-formidable'
import * as utils from './server/utils'
import { SessionData } from './server/sessionData'
import expressWebsocket from 'express-ws'

const app = express()
expressWebsocket(app)

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

// Empty watch page
app.get('/watch', (_req, resp) => {
    resp.render('watch', {
        hasVideo: false
    })
})

// Watch page
app.get('/watch/:sessionId', (req, resp) => {
    resp.render('watch', {
        hasVideo: true,
        sessionId: req.params.sessionId,
        sessionUrl: sessionData.getSessionUrl(req.params.sessionId),
        sessionTitle: sessionData.getSessionTitle(req.params.sessionId)
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
app.post('/api/create', (req, resp) => {
    utils.logPostInfo('create', req.fields, req.files)
    const fields = req.fields
    try {
        if (fields === undefined) {
            console.info('No data was posted')
            throw new Error()
        }
        if (utils.hasMembers(fields, ['title', 'url', 'password', 'controlKey'], 'string')) {
            console.info('Wrong data was posted')
            throw new Error()
        }
    } catch (_err) {
        resp.sendStatus(400)
        return
    }

    const sessionId = sessionData.addSession(
        fields.url as string,
        fields.title as string,
        fields.password as string,
        fields.controlKey as string
    )

    console.debug(`Create session with id ${sessionId}`)
    resp.redirect(`/watch/${sessionId}`)
})

type ClientMessage = ClientSyncMessage | ClientIdRequestMessage | PingRequestMessage

type SyncState = 'play' | 'pause'

interface ClientSyncMessage {
    type: 'sync'
    state: SyncState
    timeStamp: number
    origin: string
}

interface ClientIdRequestMessage {
    type: 'clientId'
    sessionId: string
}

interface PingRequestMessage {
    type: 'ping'
    iteration: number
    id: string
    clientId: string
}

/**
 * # Video synchronization manager
 *
 * In order to get an estimate of latency, the client requests a 4-part ping handshake as follows:
 *
 * ```text
 * +--------+ +-------+             +--------+
 * |        | | ping1 | ----------> |        |
 * |        | | ID    |             |        |
 * |        | +-------+   +-------+ |        |
 * |        |             | ping2 | |        |
 * |        | <---------- | ID    | |        |
 * |        |             | time  | |        |
 * | Client | +-------+   +-------+ | Server |
 * |        | | ping3 | ----------> |        |
 * |        | | ID    |             |        |
 * |        | +-------+   +-------+ |        |
 * |        |             | ping4 | |        |
 * |        | <---------- | ID    | |        |
 * |        |             | time  | |        |
 * +--------+             +-------+ +--------+
 * ```
 *
 * Client messages should include a request ID (any non-duplicate number will do). Server messages
 * should include the ID of the client request as well as the server time.
 *
 * This is done because in at least [Firefox][1], the precision of `DOMHighResTimeStamp` can be
 * 100ms or higher, which is too high to sync videos that are, for example, playing on devices in
 * the same room (they will look noticeably staggered). The latency measure may still not be enough
 * to synchronize videos beyond what a human can discern (especially audio), but this should be
 * closer than client timestamps.
 *
 * [1]: https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp#Reduced_time_precision
 * */
const wsRouter = express.Router()
wsRouter.ws('/connection', (ws, _req) => {
    ws.on('message', (rawMsg) => {
        let message: ClientMessage
        if (typeof rawMsg !== 'string') {
            console.error('ws got data that isn\'t a string')
            return
        }
        try {
            message = JSON.parse(rawMsg)
        } catch (error) {
            console.error('ws got data that isn\'t json:', rawMsg)
            return
        }

        switch (message.type) {
            case 'sync': {
                const sessionString = sessionData.getUser(message.origin)?.session
                const session = sessionString === undefined ? undefined : sessionData.getSession(sessionString)
                if (session === undefined) {
                    console.error('Unknown session:', sessionString)
                    return
                }
                for (const userString of session.users) {
                    if (userString === message.origin) {
                        continue
                    }
                    const user = sessionData.getUser(userString)
                    if (user === undefined) {
                        console.error('Unknown user:', userString)
                        return
                    }
                    if (user.socket.readyState === 1) {
                        user.socket.send(rawMsg)
                    } else {
                        console.warn('user socket not ready', user.socket.readyState)
                    }
                }
                break
            }
            case 'ping':
                switch (message.iteration) {
                    case 1:
                    case 3: {
                        const time = sessionData.getUser(message.clientId)?.joinTime
                        if (time === undefined) {
                            console.error('User not in database:', message.clientId)
                            return
                        }
                        ws.send(JSON.stringify({
                            type: 'ping',
                            id: message.id,
                            iteration: message.iteration + 1,
                            time: Date.now() - time.getTime()
                        }))
                        break
                    }
                    default:
                        console.error('Unexpected ping iteration:', message)
                }
                break
            case 'clientId': {
                if (sessionData.getSession(message.sessionId) === undefined) {
                    console.warn('No session named', message.sessionId)
                    return
                }
                const userId = sessionData.addUser('username', message.sessionId, ws)
                sessionData.addUserToSession(userId, message.sessionId)
                ws.send(JSON.stringify({
                    type: 'clientId',
                    clientId: userId
                }))
                break
            }
            default:
                break
        }
    })
})

app.use('/ws', wsRouter)
