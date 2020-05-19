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

/**
 * Video control handling
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#Events
 */

function wsReceive (sessionId: string): (msg: MessageEvent) => void {
    return msg => {
        console.log(`[${sessionId}] ${JSON.stringify(msg.data)}`)
    }
}

type SyncState = 'play' | 'pause'

interface SyncMessage {
    state: SyncState
    timeStamp: number
}

class SyncConnection {
    elem: HTMLMediaElement
    socket: WebSocket
    sessionId: string

    constructor (elem: HTMLMediaElement, socket: WebSocket, sessionId: string) {
        this.elem = elem
        this.socket = socket
        this.sessionId = sessionId
    }
}

function eventToMessage (elem: HTMLMediaElement, event: Event): SyncMessage | void {
    let state: SyncState
    switch (event.type) {
        case 'play':
        case 'pause':
            state = event.type
            break
        case 'seeked':
            state = elem.paused ? 'pause' : 'play'
            break
        default:
            console.warn('Unknown event:', event)
            return
    }
    return {
        state,
        timeStamp: elem.currentTime
    }
}

function wsSend (conn: SyncConnection): (event: Event) => void {
    return event => {
        console.debug('Event:', eventToMessage(conn.elem, event) ?? 'unknown event')
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
    const openWs = await new Promise<WebSocket>((resolve) => {
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
    return new SyncConnection(syncVideo, openWs, sessionId)
}

function initWs (conn: SyncConnection): void {
    // Add event listeners for all types of video control actions
    // @todo: Find out if these stick around when it disconnects, and if so, remove them when
    // that happens.
    for (const eventType of ['play', 'pause', 'seeked']) {
        conn.elem.addEventListener(eventType, wsSend(conn))
    }
}

// Things to run on load
async function main (): Promise<void> {
    await startWs().then(
        initWs,
        (reason) => { console.debug(reason) }
    )

    document.body.classList.remove('loading')
}

function mainSync (): void {
    main().then((_val) => {
        console.info('Main loaded')
    }).catch(err => {
        console.error(`Main failed with ${String(err)}`)
    })
}

window.addEventListener('load', mainSync)
