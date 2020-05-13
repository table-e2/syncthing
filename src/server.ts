import express from 'express'
// import fs from 'fs';
import handlebars from 'express-handlebars'
import minimist from 'minimist'

const app = express()
app.engine('handlebars', handlebars())
app.set('view engine', 'handlebars')

const args = minimist(process.argv.slice(2))
const dev = Boolean(args.dev)

const port = Number(args.port ?? 8000)

function logInfo (...args: any): void {
    console.log('[Info]', ...args)
}
function logDebug (...args: any): void {
    if (dev) {
        console.log('[Debug]', ...args)
    }
}

function logger (
    req: express.Request,
    _resp: express.Response,
    next: express.NextFunction
): void {
    logDebug(`Request at ${req.url}`)
    next()
}

app.use(logger)

app.listen(port, () => {
    if (dev) {
        logInfo('Server started in dev mode')
        logInfo(`Available at http://127.0.0.1:${port}`)
    } else {
        logInfo('Server started')
    }
})

// landing page
app.get('/', function (_req, resp) {
    resp.render('home')
})

// Any static files
app.use('/static', express.static('static'))

// JS files
app.use('/js', express.static('dist'))
if (dev) {
    // Also serve TS files when in dev so they show up in browser
    app.use('/src', express.static('src'))
}
