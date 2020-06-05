import crypto from 'crypto'
// Note: this shadows the std WebSocket, which is for clients
import WebSocket from 'ws'

/**
 * `state` is the server's version of the video's state. `playFrom` is the video timestamp when
 * `state` is `'pause'`, or current unix timestamp minus video timestamp when `state`
 * is `'play'`.
 */
export interface Session {
    url: string
    title: string
    password: string
    controlKey: string
    users: Set<string>
    state: 'play' | 'pause'
    playFrom: number
}

export interface User {
    username: string
    session: string
    joinTime: Date
    socket: WebSocket
}
/**
 * This stores a volatile copy of data for all active sessions.
 * @todo It will be changed to grab data from a persistent database.
 */
export class SessionData {
    private _users: {[key: string]: User}

    private _sessions: {[key: string]: Session}

    constructor () {
        this._users = {}
        this._sessions = {}
    }

    addUser (username: string, session: string, socket: WebSocket): string {
        const userId = crypto.randomBytes(8).toString('hex')
        this._users[userId] = {
            username,
            session,
            joinTime: new Date(),
            socket
        }
        return userId
    }

    getUser (userId: string): User | undefined {
        return this._users[userId]
    }

    addSession (url: string, title: string, password: string, controlKey: string): string {
        const sessionId = crypto.randomBytes(8).toString('hex')
        this._sessions[sessionId] = {
            url,
            title,
            password,
            controlKey,
            users: new Set(),
            state: 'pause',
            playFrom: 0
        }
        return sessionId
    }

    addUserToSession (userId: string, sessionId: string): boolean {
        if (userId in this._sessions[sessionId].users) {
            return false
        }
        this._sessions[sessionId].users.add(userId)
        return true
    }

    getSession (sessionId: string): Session | undefined {
        if (sessionId in this._sessions) {
            return this._sessions[sessionId]
        }
    }

    sendAll (sessionId: string, message: {} | string, norepeat: string): void {
        if (typeof message !== 'string') {
            message = JSON.stringify(message)
        }
        for (const user of this._sessions[sessionId].users) {
            const socket = this._users[user].socket
            if (socket.readyState !== 1 || user === norepeat) {
                continue
            }
            socket.send(message)
        }
    }
}
