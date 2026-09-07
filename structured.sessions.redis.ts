import { Application } from 'structured-fw/Application';
import { SessionEntry } from 'structured-fw/Types';
import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';

// requires Structured version >= 1.7.5

type RedisSessionOptions = {
	sessionPrefix?: string,
}

let redisClient: RedisClientType | null = null;
let options: RedisSessionOptions = {};

const sessionsKey = createHash('md5').update(import.meta.url).digest('hex') + '.sessions';

let sessions: Record<string, SessionEntry> = {};

async function initClient(): Promise<void> {
	redisClient = await createClient().on('error', (e) => {
		console.log('Redis error' + e);
	}).connect();
}

async function redisLoad(sessionDurationSeconds: number): Promise<void> {
	if (redisClient !== null) {
		const prefix = typeof options.sessionPrefix === 'string' ? options.sessionPrefix : sessionsKey;

		const keys: Array<string> = [];
		for await (const chunk of redisClient.scanIterator({
			MATCH: `${prefix}.*`,
			COUNT: 100,
		})) {
			keys.push(...chunk);
		}

		const data = await redisClient.mGet(keys);
		
		sessions = data.reduce((prev, sessionString) => {
			if (sessionString === null) {
				return prev;
			}
			const session = JSON.parse(sessionString) as SessionEntry;

			const secondsSinceLastRequest = (Date.now() - session.lastRequest) / 1000;

			if (secondsSinceLastRequest <= sessionDurationSeconds) {
				// session still valid, keep it
				prev[session.sessionId] = session;
			} else {
				// expired session, delete it from Redis
				redisSessionRemove(session.sessionId);
			}

			return prev;
		}, {} as Record<string, SessionEntry>);
	}
}

function sessionKey(sessionId: string): string {
	const sessionPrefix = typeof options.sessionPrefix === 'string' ? options.sessionPrefix : sessionsKey;
	return `${sessionPrefix}.${sessionId}`;
}

async function redisStoreSession(sessionId: string): Promise<void> {
	if (redisClient === null || !(sessionId in sessions)) {return;}
	await redisClient.set(sessionKey(sessionId), JSON.stringify(sessions[sessionId]));
}

async function redisValueSet(sessionId: string, key: string, value: any): Promise<void> {
	if (sessionId in sessions) {
		sessions[sessionId].data[key] = value;
		await redisStoreSession(sessionId);
	}
}

async function redisValueRemove(sessionId: string, key: string): Promise<void> {
	if (sessionId in sessions) {
		delete sessions[sessionId].data[key];
		await redisStoreSession(sessionId);
	}
}

async function redisSessionRemove(sessionId: string): Promise<void> {
	delete sessions[sessionId];
	if (redisClient) {
		await redisClient.del(sessionKey(sessionId));
	}
}

async function redisSessionExtend(sessionId: string): Promise<void> {
	if (sessionId in sessions) {
		sessions[sessionId].lastRequest = Date.now();
		await redisStoreSession(sessionId);
	}
}

async function redisClear(sessionId: string): Promise<void> {
	if (sessionId in sessions) {
		sessions[sessionId].data = {};
		await redisStoreSession(sessionId);
	}
}

export async function redisSessions(app: Application, sessionOptions: RedisSessionOptions): Promise<void> {
	options = sessionOptions;

	app.on('sessionsStart', async () => {
		// sessions enabled, load sessions from Redis
		await initClient();
		await redisLoad(app.config.session.durationSeconds);
		app.session.load(sessions);
	});

	app.on('sessionCreated', (entry) => {
		sessions[entry.sessionId] = entry;
		redisStoreSession(entry.sessionId);
	});

	app.on('sessionValueSet', async ([sessionId, key, value]) => {
		await redisValueSet(sessionId, key, value);
	});

	app.on('sessionValueRemove', async ([sessionId, key]) => {
		redisValueRemove(sessionId, key);
	});

	app.on('sessionExpired', async(sessionId) => {
		redisSessionRemove(sessionId);
	});

	app.on('sessionExtended', async(sessionId) => {
		redisSessionExtend(sessionId);
	});

	app.on('sessionClear', async(sessionId) => {
		redisClear(sessionId);
	});
}