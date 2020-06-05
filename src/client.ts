/* eslint-disable @typescript-eslint/no-unused-vars */
// Helper functions
function id (elemId: string): HTMLElement | null {
    return document.getElementById(elemId)
}

async function sleep (milliseconds: number): Promise<void> {
    return await new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    })
}

function testPost (): void {
    console.log('Sending test')
    const form = new FormData()
    const testData: {[key: string]: string} = {
        username: 'aaa',
        url: 'http://127.0.0.1:8000/static/temp/okgo.webm',
        password: '***',
        control_key: 'lol',
        title: 'woot'
    }
    for (const key in testData) {
        form.append(key, testData[key])
    }
    fetch('/api/create',
        {
            body: form,
            method: 'post'
        }
    ).then(resp => {
        console.log('Sent test form')
        if (resp.redirected) {
            window.location.assign(resp.url)
        }
    }).catch(() => {
        console.log('Failed to send test form')
    })
}

function ifKey (keys: string[] | string, callback: () => void): (event: KeyboardEvent) => void {
    if (typeof keys === 'string') {
        return (event: KeyboardEvent) => {
            if (event.key === keys) {
                callback()
            }
        }
    }

    const keysSet = new Set(keys)
    return (event: KeyboardEvent) => {
        if (keysSet.has(event.key)) {
            callback()
        }
    }
}

function videoRedirect (): void {
    const loc = window.location
    const newLoc = `${loc.protocol}//${loc.host}/watch/${(id('videoId') as HTMLInputElement).value}`
    window.location.assign(newLoc)
}

type SyncState = 'play' | 'pause'

/**
 * A message containing data to sync the video. Can be sent either way.
 */
interface SyncMessage {
    type: 'sync'
    state: SyncState
    timeStamp: number
    origin: string
    session: string
}

/**
 * A message sent by the server in response to a ping sent by this client.
 */
interface PingMessage {
    type: 'ping'
    id: string
    iteration: number
    time: number
}

/**
 * A message sent by the server in response to the client asking for an ID.
 */
interface ClientIdMessage {
    type: 'clientId'
    clientId: string
}

type ServerMessage = SyncMessage | PingMessage | ClientIdMessage

/**
 * Video control handling
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#Events
 */
class SyncConnection {
    elem: HTMLMediaElement
    socket: WebSocket
    sessionId: string
    pingTimes: number[]
    pingInProgress: [string, ((ping: number) => void), number | void] | undefined
    clientId: string | (() => void) | undefined
    state: 'pause' | 'play'
    playFrom: number

    constructor (elem: HTMLMediaElement, socket: WebSocket, sessionId: string) {
        this.elem = elem
        this.socket = socket
        this.sessionId = sessionId
        this.pingTimes = []
        this.state = 'pause'
        this.playFrom = 0
    }

    async initWs (): Promise<void> {
        this.socket.addEventListener('message', event => this.wsReceive(event))

        await this.getClientId()

        for (let i = 0; i < 3; i++) {
            // Give the page time to relax so that things are less likely to interrupt ping
            await sleep(500)

            const ping = await this.measurePing()
            console.info(`Ping: ${ping}ms`)
        }
        console.info(`Average ping: ${this.avgPing()}ms`)

        // Check ping every 10 seconds
        setInterval(() => {
            this.measurePing().then(ping =>
                console.info(`Ping: ${ping}ms (${this.avgPing()}ms avg)`)
            ).catch(e =>
                console.error('Couldn\'t measure ping', e)
            )
        }, 10_000)

        let timeout: ReturnType<typeof setTimeout> | undefined
        // Debounce the calls so messages aren't spammed
        const debounce = (event: Event): void => {
            if (timeout !== undefined) {
                clearTimeout(timeout)
            }
            timeout = setTimeout(() => {
                timeout = undefined

                this.wsSend(event)
            }, 1000)
        }
        // Add event listeners for all types of video control actions
        // @todo Find out if these stick around when it disconnects, and if so, remove them when
        // that happens.
        for (const eventType of ['play', 'pause', 'seeked']) {
            this.elem.addEventListener(eventType, debounce)
        }
    }

    async getClientId (): Promise<void> {
        return await new Promise<void>(resolve => {
            this.clientId = resolve
            this.socket.send(JSON.stringify({
                type: 'clientId',
                sessionId: this.sessionId
            }))
            // This promise is resolved by this.wsReceive
        })
    }

    async measurePing (): Promise<number> {
        if (typeof this.clientId !== 'string') {
            return await Promise.reject(Error('No client ID recorded'))
        }
        const id = new Uint8Array(8)
        const idString = window
            .crypto
            .getRandomValues(id)
            .reduce((acc, cur) => acc + cur.toString(16).padStart(2, '0'), '')

        return new Promise<number>(resolve => {
            this.pingInProgress = [idString, resolve, undefined]
            this.socket.send(JSON.stringify({
                type: 'ping',
                iteration: 1,
                id: idString,
                clientId: this.clientId
            }))
        }).then(ping => {
            this.addPing(ping)
            return ping
        })
        // The rest of this is handled by this.wsReceive
    }

    /** Calculates the average ping minus the highest values */
    avgPing (): number {
        const temp = this.pingTimes.slice()
        temp.sort((a, b) => a - b)
        for (let i = 0; i < temp.length / 4; i++) {
            temp.pop()
        }
        if (temp.length === 0) {
            return 0
        }
        return temp.reduce((acc, item) => acc + item) / temp.length
    }

    addPing (ping: number): void {
        // Keep 8 pings in storage for computing average
        while (this.pingTimes.length > 8) {
            this.pingTimes.shift()
        }
        this.pingTimes.push(ping)
    }

    eventToMessage (event: Event): SyncMessage | void {
        if (!event.isTrusted) {
            return
        }
        let timeStamp = this.elem.currentTime

        if (this.elem.paused || this.elem.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            if (this.state === 'pause' && timeStamp === this.playFrom) {
                return
            }
            this.state = 'pause'
            this.playFrom = timeStamp
        } else {
            timeStamp += this.avgPing() / 2
            const newPlayFrom = Date.now() - timeStamp
            if (this.state === 'play' && Math.abs(newPlayFrom - this.playFrom) < 500) {
                return
            }
            this.state = 'play'
            this.playFrom = newPlayFrom
        }

        // We don't have a client id apparently
        if (typeof this.clientId !== 'string') {
            console.error('No client id')
            return
        }

        return {
            type: 'sync',
            state: this.state,
            timeStamp,
            origin: this.clientId,
            session: this.sessionId
        }
    }

    wsSend (event: Event): void {
        const message = this.eventToMessage(event)
        if (message !== undefined) {
            this.socket.send(JSON.stringify(message))
        }
    }

    wsReceive (event: MessageEvent): void {
        let message: ServerMessage
        try {
            message = JSON.parse(event.data)
        } catch (error) {
            console.error('Could not parse websocket message:', event.data)
            return
        }
        switch (message?.type) {
            case 'sync':
                switch (message.state) {
                    case 'play': {
                        const timeStamp = message.timeStamp + this.avgPing() / 2
                        const newPlayFrom = Date.now() - timeStamp
                        if (this.state === 'play' && Math.abs(newPlayFrom - this.playFrom) < 500) {
                            return
                        }
                        this.elem.play().then(
                            () => { this.elem.currentTime = timeStamp }
                        ).catch(
                            e => console.error('Could not play:', e)
                        )
                        break
                    }
                    case 'pause':
                        if (this.state === 'pause' && message.timeStamp === this.playFrom) {
                            return
                        }
                        this.elem.pause()
                        this.elem.currentTime = message.timeStamp
                        break

                    default:
                        console.error('Unknown state:', message)
                        break
                }
                break
            case 'clientId': {
                if (typeof this.clientId === 'function') {
                    this.clientId()
                }
                this.clientId = message.clientId

                break
            }
            case 'ping': {
                // If there isn't one in progress or the one in progress isn't the one we
                // started (another one was started in the meantime I guess), then ignore.
                if (this.pingInProgress === undefined || this.pingInProgress[0] !== message.id) {
                    console.warn('Discarded duplicate ping')
                    return
                }
                const iter = message.iteration
                switch (iter) {
                    case 2:
                        this.pingInProgress[2] = message.time
                        this.socket.send(JSON.stringify({
                            type: 'ping',
                            iteration: iter + 1,
                            id: message.id,
                            clientId: this.clientId
                        }))
                        break

                    case 4: {
                        const difference = message.time - (this.pingInProgress[2] as number)
                        const callback = this.pingInProgress[1]
                        this.pingInProgress = undefined
                        callback(difference)
                        break
                    }
                    default:
                        console.error('Unexpected ping iteration:', message)
                        break
                }
                break
            }
            default:
                console.error('Unknown message type:', message)
                break
        }
    }
}

async function startWs (): Promise<SyncConnection> {
    // Get the video element
    const syncVideo = id('syncVideo')
    // Get the session id
    const sessionId = syncVideo?.dataset?.sessionId
    // Check if both exist
    if (!(syncVideo instanceof HTMLMediaElement)) {
        return await Promise.reject(Error('No video present'))
    }
    if (sessionId === undefined) {
        return await Promise.reject(Error('No sessionId present'))
    }

    // Create a websocket and wait for it to be connected
    const openWs = await new Promise<WebSocket>(resolve => {
        const ws = new WebSocket(`ws://${window.location.host}/ws/connection`)
        // What to do if it ever closes
        ws.addEventListener('close', (event) => {
            console.error('Websocket disconnected with code ', event.code)
            document.body.classList.add('disconnected')
        })
        // Return the created websocket
        ws.addEventListener('open', function () { resolve(this) })
    })

    // If we were disconnected before, we aren't anymore
    document.body.classList.remove('disconnected')
    const conn = new SyncConnection(syncVideo, openWs, sessionId)
    await conn.initWs()
    return conn
}

// Things to run on load
async function main (): Promise<void> {
    await startWs().catch(
        reason => {
            if (reason.message === 'No video present') {
                return
            }
            console.debug(reason)
        }
    )

    document.body.classList.remove('loading')
}

function mainSync (): void {
    main().then((_val) => {
        console.info('Main loaded')
    }).catch(err => {
        console.error('Main failed with err:', err)
    })
}

window.addEventListener('load', mainSync)
