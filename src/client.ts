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

function startWs (sessionId: string): void {
    document.body.classList.remove('disconnected')
    const ws = new WebSocket(`ws://${window.location.host}/ws/connection`)
    ws.addEventListener('open', () => {
        ws.send('hello')
    })
    ws.addEventListener('message', wsReceive(sessionId))
    ws.addEventListener('close', closeEvent => {
        console.error(`Websocket event closed with status ${closeEvent.code}`)
        document.body.classList.add('disconnected')
    })
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

// Things to run on load
async function main (): Promise<void> {
    await sleep(1000)

    document.body.classList.remove('loading')
}

function mainSync (): void {
    main().then((_val) => {
        console.log('Main loaded')
    }).catch(err => {
        console.log(`Main failed with ${String(err)}`)
    })
}

window.addEventListener('load', mainSync)
