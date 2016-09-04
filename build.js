var fs = require('fs');
var pp = require('jsfx-preprocessor');

var source = fs.readFileSync(__dirname + '/ui-lib.txt', {encoding: 'utf-8'});
var targetFile = process.argv[2] || 'ui-lib.jsfx-inc';
fs.writeFileSync(targetFile, pp(source));