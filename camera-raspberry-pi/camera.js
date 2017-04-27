/*jshint strict: false*/
/*jshint -W104*/
/**
 * Module for Raspberry Pi Camera v1 interaction.
 *
 * Can also be used for Raspberry Pi Camera v2, however you have to set the
 * height and width explicitly. Do not use mode parameters when using Raspberry
 * Pi Camera v2.
 *
 */
"use strict";

const childprocess = require('child_process');
const spawn = childprocess.spawn;

const EX_OK         =   0; // Application ran successfully
const EX_USAGE      =  64; // Bad command line parameter
const EX_SOFTWARE   =  70; // Software or camera error
const EX_TERMINATED = 130; // Application terminated by ctrl-C

void EX_OK;
void EX_USAGE;
void EX_SOFTWARE;
void EX_TERMINATED;

const VERBOSE = false; // whether to log debug information
const SILENT  = false; // do not log unless an error is encountered

const PROC_SPAWN_OPTS = {
	encoding: "buffer",
	timeout: 5000, // 5 seconds
};

const CMD_NAME = 'raspiyuv';

const CMD_ARGS = [
	'-n',    // do not show preview window
	'-o','-' // write to stdout
];

// raspberry pi has default modes changeing the images
// dimensions. this maps mode numbers to width and height
const MODE_DIMENSIONS = [
	{width: undefined, height: undefined}, // autoselect
	{width: 1920, height: 1080},
	{width: 2592, height: 1944},
	{width: 2592, height: 1944},
	{width: 1296, height:  972},
	{width: 1296, height:  730},
	{width:  640, height:  480},
	{width:  640, height:  480},
];

const DEFAULT_MODE = 3;

const MSG_START       = '[rasberry cam] starting capturing';
const MSG_DONE        = '[rasberry cam] done capturing';
const MSG_BUFFER      = '[rasberry cam] recieved buffer with %s byte';
const MSG_CMD         = '[rasberry cam] executing command: %s %s';
const MSG_ERROR       = '[rasberry cam] error: %s';
const MSG_EXIT_NORMAL = '[rasberry cam] child process exited with code %d';
const MSG_EXIT_ERROR  = '[rasberry cam] child procss exited unexpectedly with code %d';
const MSG_SPAWN_ERROR = '[rasberry cam] spawning of command failed: %s';

module.exports = {
	capture_image: capture_image,
	image_dimensions: image_dimensions,
};

const camera_busy = [false, false];
const waiting = [[],[]];

/**
 * Returns the width and height of the image given the
 * supplied command line options.
 */
function image_dimensions(opts) {
	opts = opts || {};

	// TODO: test what happens if automatic ist combined with
	// width and height. Test if width or height can be supplied alone.
	// add support for automatic mode 0.
	var mode = opts.mode || opts.md || DEFAULT_MODE;
	
	var dimensions = MODE_DIMENSIONS[mode];

	dimensions.width = opts.width || opts.w || dimensions.width;
	dimensions.height = opts.height || opts.h || dimensions.height;

	return dimensions;
}

function _camera_index(opts) {
	opts = opts || {};
	return opts.camselect || opts.cs || 0;
}

/**
 * Get raw rgb data from the rasberry pi camera.
 *
 * @param FUNCTION done is called as soon as the capturing is
 *                      done. One argument is passed, containg
 *                      an image buffer on success, and null
 *                      on error.
 */
function capture_image(done, opts) {

	const cam_index = _camera_index(opts);

	if(camera_busy[cam_index]) {
		waiting[cam_index].push({done: done, opts: opts});
	} else {
		camera_busy[cam_index] = true;
		_capture_image(done, opts);
	}
}

function _capture_image(done, opts) {
	console.info(MSG_START);

	opts = opts || {};

	if(opts.has_mode_support && typeof opts.mode !== 'number' && typeof opts.md !== 'number') {
		opts.md = DEFAULT_MODE;
	}

	delete opts.has_mode_support;

	_rename_opt("exposure_mode", "exposure", opts);
	_rename_opt("exposure_compensation", "ev", opts);
	_rename_opt("automatic_white_balance", "awb", opts);
	_rename_opt("shutterspeed", "shutter", opts);
	_rename_opt("horizontal_flip", "hflip", opts);
	_rename_opt("vertical_flip", "vflip", opts);

	var flags = _flag_array(opts).concat(CMD_ARGS);

	if(!SILENT) {
		console.info(MSG_CMD, CMD_NAME, flags.join(' '));
	}

	const cam = spawn(CMD_NAME, flags, PROC_SPAWN_OPTS);

	cam.on('error', function(e) {
		console.error(MSG_SPAWN_ERROR, e);
	});

	var callinfo = {
		callback: done,
		//callback_executed: false,
		buffers: [],
		opts: opts
	};


	cam.stdout.on('data', (function(callinfo) {
		return function(data) {
			if(VERBOSE) {
				console.debug(MSG_BUFFER, data.length);
			}
			callinfo.buffers.push(data);
		};
	})(callinfo));

	cam.stderr.on('data', (function(/*callinfo*/) {
		return function(data) {
			console.error(MSG_ERROR, data);
		};
	})(callinfo));

	cam.on('close', (function(callinfo) {
		return function(exitcode) {

			const data = Buffer.concat(callinfo.buffers);
			const dimensions = image_dimensions(callinfo.opts);

			if(dimensions.width*dimensions.height <= data.length/3) {
				if(!SILENT) {
					console.info(MSG_DONE);
					console.info(MSG_EXIT_NORMAL, exitcode);
				}
				//const length_without_gpu_alignment = dimensions.width*dimensions.height*3;
				//done(data.slice(0, length_without_gpu_alignment));
				done(data);
			} else {
				console.error(MSG_EXIT_ERROR, exitcode);
				done(null, exitcode);
			}

			_process_next(callinfo);
		};
	})(callinfo));
}

function _process_next(callinfo) {
	
	const cam_index = _camera_index(callinfo.opts);
	if(waiting[cam_index].length === 0) {
		camera_busy[cam_index] = false;	
	} else {
		const next = waiting[cam_index].shift();
		_capture_image(next.done, next.opts);
	}
}

function _rename_opt(from, to, opts) {
	if(typeof opts[from] != "undefined") {
		opts[to] = opts[from];
		delete opts[from];	
	}
}

function _flag_array(opts) {

	var flags = [];

	for (var flagname in opts) {
		if (opts.hasOwnProperty(flagname)) {
			flags.push((flagname.length <= 3 ? "-" : "--") + flagname);
			if(typeof opts[flagname] !== "boolean") {
				flags.push("" + opts[flagname]);
			}
		}
	}

	return flags;
}
