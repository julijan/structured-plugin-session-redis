# structured-plugin-session-redis
This is a plugin for [Structured framework](https://www.npmjs.com/package/structured-fw) that allows for persistent sessions using Redis.

To use the plugin, install it using:\
`npm install structured-plugin-session-redis`

In your entry TS file, before calling app.init(), add:\
`app.registerPlugin(redisSessions, {});`

You will no longer lose sessions when you restart the app.