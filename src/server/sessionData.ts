import crypto from 'crypto'

/**
 * This stores a volatile copy of data for all active sessions.
 * @todo It will be changed to grab data from a persistent database.
 */
export class SessionData {
    private _users: {[key: string]: {
        username: string
        sessions: Set<string>
    }}

    private _sessions: {[key: string]: {
        url: string
        password: string
        controlKey: string
        users: Set<string>
    }}

    constructor () {
        this._users = {}
        this._sessions = {}
    }

    addUser (username: string): string {
        const userId = crypto.randomBytes(8).toString('hex')
        this._users[userId] = {
            username,
            sessions: new Set()
        }
        return userId
    }

    addSession (url: string, password: string, controlKey: string): string {
        const sessionId = crypto.randomBytes(8).toString('hex')
        this._sessions[sessionId] = {
            url,
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
}
