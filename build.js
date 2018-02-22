var fs = require('fs');
var pp = require('jsfx-preprocessor');

var source = fs.readFileSync(__dirname + '/ui-lib.txt', {encoding: 'utf-8'});
var result = pp(source);

['ui-lib.jsfx-inc'].concat(process.argv.slice(2)).forEach(function(targetFile) {
	console.log(targetFile);
	fs.writeFileSync(targetFile, result);
	console.log('wrote: ' + targetFile);
});
