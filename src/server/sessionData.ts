import crypto from 'crypto'
// Note: this shadows the std WebSocket, which is for clients
import WebSocket from 'ws'

export interface Session {
    url: string
    title: string
    password: string
    controlKey: string
    users: Set<string>
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
            users: new Set()
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

    getSession (sessionId: string): Session | void {
        if (sessionId in this._sessions) {
            return this._sessions[sessionId]
        }
    }

    getSessionUrl (sessionId: string): string | undefined {
        return this._sessions[sessionId]?.url
    }

    getSessionTitle (sessionId: string): string | undefined {
        return this._sessions[sessionId]?.title
    }
}
