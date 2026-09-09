import { auth } from '../../../../lib/auth.ts'
import { toNextJsHandler } from 'better-auth/next-js'
import getSessionFromRequest from '../../../../lib/session.ts'

const handlers = toNextJsHandler(auth)

async function guardSignUp(req: Request) {
	try {
		const url = new URL(req.url, 'http://localhost')
		if (req.method === 'POST' && url.pathname === '/api/auth/sign-up/email') {
			const session = await getSessionFromRequest(req)
			if (!session || !(session.role === 'Admin' || session.role === 'SuperAdmin')) {
				return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
			}
		}
	} catch (err) {
		console.error('Sign-up guard error', err)
		return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
	}

	return null
}

export const GET = handlers.GET

export const POST = async (req: Request) => {
	const blocked = await guardSignUp(req)
	if (blocked) return blocked
	return handlers.POST(req)
}

export const PATCH = handlers.PATCH
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE
