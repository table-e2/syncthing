import express from 'express'
import formidable from 'formidable'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2))
export const devMode = Boolean(args.dev)

export const port = Number(args.port ?? 8000)

export function logger (
    req: express.Request,
    _resp: express.Response,
    next: express.NextFunction
): void {
    console.debug(`${req.method} at ${req.url}`)
    next()
}

export function logPostInfo (
    type: string,
    fields?: formidable.Fields,
    files?: formidable.Files
): void {
    if (fields?.password !== undefined) {
        fields.password = '***'
    }
    let message = `POSTed to ${type} with`
    if (fields !== undefined) {
        message += `\n${JSON.stringify(fields, undefined, 4)}`
    }
    if (files !== undefined) {
        const nFiles = Object.keys(files).length
        if (nFiles > 0) {
            message += `\n${nFiles} files:`
            for (const file in files) {
                message += '\n'
                message += files[file].name
                message += ` (${files[file].size})`
            }
        }
    }
    console.debug(message)
}

export function hasMembers (object: {[key: string]: any}, members: string[], type?: string): boolean {
    return members.every(member => {
        Object.prototype.hasOwnProperty.call(object, member)
    }) && (type === undefined ? true : members.every(member =>
        // eslint-disable-next-line valid-typeof
        typeof object[member] === type
    ))
}
