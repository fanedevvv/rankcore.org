'use strict';

// Routes:
//   GET    /internal/rest/get
//   POST   /internal/rest/post
//   PATCH  /internal/rest/patch
//   DELETE /internal/rest/delete
//   PUT    /internal/rest/put
//
// SECURITY: Strictly whitelisted Discord API routes only. Arbitrary calls
// (banning, role creation, channel deletion, etc.) are blocked at this layer.

const { Router } = require('express');
const { REST }   = require('discord.js');

const ALLOWED_ROUTES = [
  /^\/channels\/\d{17,20}\/messages$/,                                    // send message (embed creator)
  /^\/applications\/\d{17,20}\/guilds\/\d{17,20}\/commands$/,             // list/create guild commands
  /^\/applications\/\d{17,20}\/guilds\/\d{17,20}\/commands\/\d{17,20}$/, // patch/delete guild command
];

const ALLOWED_PUT = /^\/applications\/\d{17,20}\/commands$/; // bulk global command sync only

function isAllowed(route) {
  return typeof route === 'string' && ALLOWED_ROUTES.some(r => r.test(route));
}

function botRest() {
  return new REST({ version: '10' }).setToken(process.env.token);
}

module.exports = (_client) => {
  const router = Router();

  router.get('/internal/rest/get', async (req, res) => {
    const route = req.query.route;
    if (!isAllowed(route)) return res.status(400).json({ error: 'Route not permitted' });
    try { res.json(await botRest().get(route)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/internal/rest/post', async (req, res) => {
    const route = req.body?.route;
    if (!isAllowed(route)) return res.status(400).json({ error: 'Route not permitted' });
    try { res.json({ success: true, result: await botRest().post(route, { body: req.body.body }) }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.patch('/internal/rest/patch', async (req, res) => {
    const route = req.body?.route;
    if (!isAllowed(route)) return res.status(400).json({ error: 'Route not permitted' });
    try { res.json({ success: true, result: await botRest().patch(route, { body: req.body.body }) }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/internal/rest/delete', async (req, res) => {
    const route = req.body?.route;
    if (!isAllowed(route)) return res.status(400).json({ error: 'Route not permitted' });
    try { res.json({ success: true, result: await botRest().delete(route) }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT is only used for bulk application command sync (global scope)
  router.put('/internal/rest/put', async (req, res) => {
    const route = req.body?.route;
    if (typeof route !== 'string' || !ALLOWED_PUT.test(route))
      return res.status(400).json({ error: 'Route not permitted' });
    try { res.json({ success: true, result: await botRest().put(route, { body: req.body.body }) }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};