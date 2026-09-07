# structured-plugin-session-redis
This is a plugin for [Structured framework](https://www.npmjs.com/package/structured-fw) that allows for persistent sessions using Redis.

To use the plugin, install it using:\
`npm install structured-plugin-session-redis`

In your entry TS file:\
`import { redisSessions } from 'structured-plugin-session-redis';`

Then, before calling app.init(), add:\
`app.registerPlugin(redisSessions, {});`\
*Second argument is the options (`RedisSessionOptions`)*

Options:
```
type RedisSessionOptions = {
	sessionPrefix?: string,
	preserveTypes?: boolean,
}
```

`sessionPrefix` - sessions are stored in Redis with key [sessionPrefix].[sessionId], if omitted prefix is auto generated based on the app path\
`preserveTypes` - if `true`, additional types will survive data serialization (Date, BigInt, RegExp, Map and Uint8Array)


You will no longer lose sessions when you restart the app.