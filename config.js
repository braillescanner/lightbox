const fs = require('fs');
const stripComments = require('strip-json-comments');

var config, external = false;

try {
	require.resolve("config"); // this jumps to catch() if no external configuration is available.
	console.info("external configuration detected.");
	external = true;
	config = require("config");
} catch(e) {
	if(external) {
		console.error("failed to load external configuration file");
		console.error(e);
		process.exit(1);
	}

	try {
		var json = stripComments(fs.readFileSync('./config.comments.json', 'utf8'));
		config = JSON.parse(json);
	} catch(e) {
		console.error("Failed to load internal default configuration");
		console.error(e);
		process.exit(1);
	}
}

module.exports = config;
