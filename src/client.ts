// Helper functions
function id (elemId: string): HTMLElement | null {
    return document.getElementById(elemId)
}

async function sleep (milliseconds: number): Promise<void> {
    return await new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    })
}

// Things to run on load
async function main (): Promise<void> {
    await sleep(1000)

    // A button to send a sample request
    id('test')?.addEventListener('click', () => {
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
        ).then((resp) => {
            console.log('Sent test form')
            if (resp.redirected) {
                window.location.assign(resp.url)
            }
        }).catch(() => {
            console.log('Failed to send test form')
        })
    })

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
