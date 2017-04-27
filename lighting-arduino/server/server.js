/*jshint strict: false*/
/*jshint -W104*/

const config      = require('../../config');
const SerialPort  = require('serialport');
const express     = require('express');

const app = express();

const port = new SerialPort(config.light_serial_port_path, {
  baudRate: config.light_serial_baud_rate
});

SerialPort.list(function(err, ports) {
	console.log('[Serial Port] List of available ports: ');
	ports.forEach(function(port) {
		console.log("    ", port.comName, "    ", port.pnpId, "    ", port.manufacturer);
	});
});


port.on('error', function(err) {
	console.log('[Serial Port] Error: ', err.message);
});

port.on('open', function() {
	console.log('[Serial Port] Port <', config.light_serial_port_path, '> opened');
});

port.on('close', function() {
	console.log('[Serial Port] Port <', config.light_serial_port_path, '> closed');
	process.exit();
});

port.on('disconnect', function() {
	console.log('[Serial Port] Port <', config.light_serial_port_path, '> disconnected');
});

port.on('data', function(data) {
	console.log('[Arduino sent]', data);
});

app.get("/strip/:strip/intensity/:intensity", function(req, res) {
	req.params.led = config.LED_strip_length;
	strip_updater(req, res);
});

app.get("/strip/:strip/LED/:led/intensity/:intensity", strip_updater);

app.listen(config.light_server_port);

console.log('[HTTP Server] light box server running at http://127.0.0.1:' + config.light_server_port+'/');

function strip_updater(req, res) {
	var led = ~~(+req.params.led);
	var strip = ~~(+req.params.strip);
	var brightness = ~~(+req.params.intensity);

	if(led > config.LED_strip_length || led < 0) {
		console.log("[HTTP Server] rejected LED state update for invalid LED number <", led, ">");
		return;
	}

	if(strip >= config.LED_strip_count || strip < 0) {
		console.log("[HTTP Server] rejected LED state update for invalid LED-strip number <", strip, ">");
		return;
	}

	// there is a last virtual LED that will change all LEDs in the strip!
	var led_address = (config.LED_strip_length+1) * strip + led;

	if(led_address > 0xFF) {
		console.log("[HTTP Server] rejected LED state update for invalid LED address <", led_address, ">");
		return;
	}
	
	var low  = brightness & 0xFF;
	var mid  = brightness >> 8  & 0xFF;
	var high = brightness >> 16 & 0xFF;

	console.log("[HTTP Server] setting strip <", strip ,"> led <", led, "> to intensity <", high << 16 | mid << 8 | low, ">");
	port.write([led_address, high, mid, low]);

	res.setHeader('Access-Control-Allow-Origin', '*');
	res.send();
}
