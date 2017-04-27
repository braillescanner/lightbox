/*jshint strict: false*/
/*jshint -W104*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const camera = require('./camera');

const config = require('../config');

function answerReq(response, file, mime) {
	response.writeHead(200, {"Content-Type": mime});

	fs.createReadStream(path.resolve(__dirname, file))
		.pipe(response);
}

void answerReq;

function answerCameraCaptureRequest(response, colormodel) {
	delete config.camera_options.y;	
	delete config.camera_options.luma;
	delete config.camera_options.rgb;
	config.camera_options[colormodel] = true;

	camera.capture_image(function(buffer) {

		if(buffer === null) {
			response.writeHead(500, {'Content-Type': 'text/plain'});
			response.end("500: Internal Server Error\nRaspberry Pi Camera cannot be found or is misconfigured.");
			return;
		}

		response.writeHead(200, {'Content-Type': 'application/octet-stream'});
		response.end(buffer, 'binary');

	}, config.camera_options);
}

http.createServer(function (request, response) {

	response.setHeader('Access-Control-Allow-Origin', '*');

	if(request.url.toLowerCase() === "/g8") {
		answerCameraCaptureRequest(response, "luma");
	} else if(request.url.toLowerCase() === "/rgb888") {
		answerCameraCaptureRequest(response, "rgb");
	} else {
		response.writeHead(404, {'Content-Type': 'text/plain'});
		response.end("404: Not Found");
	}

}).listen(config.camera_server_port);

console.log('Raspberry Pi camera server running at http://127.0.0.1:'+config.camera_server_port+'/');
