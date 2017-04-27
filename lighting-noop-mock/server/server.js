/*jshint strict: false*/
/*jshint -W104*/

const config      = require('../../config');
const express     = require('express');

const app = express();

function noop_handler(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.send();
}

app.get("/strip/:strip/intensity/:intensity", noop_handler);

app.get("/strip/:strip/LED/:led/intensity/:intensity", noop_handler);

app.listen(config.light_server_port);

console.log('[HTTP Server] light box mock server running at http://127.0.0.1:' + config.light_server_port+'/');
