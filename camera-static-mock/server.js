/*jshint strict: false*/
/*jshint -W104*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// will serve L lighting on first request and R lighting on second request
const MAX_WAIT_SECOND_REQUEST_MS = 7000;

function answerReq(response, file, mime) {
	response.writeHead(200, {"Content-Type": mime});

	fs.createReadStream(path.resolve(__dirname, file))
		.pipe(response);
}

function tryAnswerAsPngReq(url, id, response) {
	if(url.slice(0, "/png_"+id+"_".length) === "/png_"+id+"_" &&
			url.length === "/png_"+id+"_".length+1) {

		var num = url.charCodeAt("/png_"+id+"_".length) - "0".charCodeAt(0);
		if(num >= 0 && num <= 8) {
			answerReq(response, "png_l_"+num+".png", "image/png");
			return true;
		}
	}

	return false;
}

function answerTimedRequest(url, response) {
	var current_time = Date.now();
	var $ = TIMED_URLs[url];

	if($.timer >= 0 && current_time < $.timer + MAX_WAIT_SECOND_REQUEST_MS) {
		// this is the second request in a shadow image setup
		$.timer = -1;
		answerReq(response, $.second, $.format);
	} else {
		// this is the first request in a shadow image setup
		$.timer = current_time;
		answerReq(response, $.first, $.format);
	}

	return;
}

var BINARY = "application/octet-stream",
    PNG    = "image/png"; 

var URLs = {
	"/png_l":       {file: "png_l_0.png",     format: PNG},
	"/png_r":       {file: "png_r_0.png",     format: PNG},
	"/rgb888_r":    {file: "rgb888_R.binary", format: BINARY},
	"/rgb888_l":    {file: "rgb888_L.binary", format: BINARY},
	"/g8_r":        {file: "g8_R.binary",     format: BINARY},
	"/g8_l":        {file: "g8_L.binary",     format: BINARY},
	"/favicon.ico": {file: "favicon.ico",     format: "image/x-icon"},
}

var TIMED_URLs = {
	"rgb888": {timer: -1, format: BINARY, first: "rgb888_L.binary", second: "rgb888_R.binary"},
	"g8":     {timer: -1, format: BINARY, first: "g8_L.binary", second: "g8_R.binary"}
}

http.createServer(function (request, response) {

	response.setHeader('Access-Control-Allow-Origin', '*');

	var url = request.url.toLowerCase();

	if(tryAnswerAsPngReq(url, "r", response) || tryAnswerAsPngReq(url, "l", response)) {
		return;
	}

	if(URLs.hasOwnProperty(url)) {
		answerReq(response, URLs[url].file, URLs[url].format);
		return;
	}

	if(TIMED_URLs.hasOwnProperty(url)) {
		answerTimedRequest(url, response);
		return;
	}

	response.writeHead(404, {'Content-Type': 'text/plain'});
	response.end("404: Not Found");
}).listen(config.camera_server_port);

console.log('Server running at http://127.0.0.1:'+config.camera_server_port+'/');
