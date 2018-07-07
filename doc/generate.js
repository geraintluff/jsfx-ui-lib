function htmlEscape(text) {
	return text.split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
}

function indent(code, N) {
	var tab = '\t';
	if (N > 0) {
		for (var i = 1; i < N; i++) {
			tab += '\t';
		}
	}
	return tab + code.trim().split('\n').join('\n' + tab) + '\n';
}

function filloutParams(params, pageId) {
	return [].concat(params).map((param, index) => {
		if (typeof param === 'string') {
			param = {name: param};
		}
		param.name = param.name || ('arg' + (index + 1));
		if (param.type == 'text' && param.name[0] !== '#') {
			param.name = '#' + param.name;
		}
		if (!param.type && param.name[0] == '#') {
			param.type = 'text';
		}
		param.var = param.var || param.name;
		if (param.type === 'boolean') param.type = 'bool';
		if (param.type === 'integer') param.type = 'int';
		if (!param.type) param.type = 'number';

		if (param.text && !param.html) {
			param.html = htmlEscape(param.text);
		}
		return param;
	});
}

function filloutApi(api, pageId, options, usedIds) {
	options = options || {};
	options.idSuffix = options.idSuffix || '';
	options.idPrefix = options.idPrefix || '';
	usedIds = usedIds || {};

	if (api.text && !api.html) {
		api.html = api.text.split('\n\n').map(para => '<p>' + htmlEscape(para) + '</p>').join('\n');
	}

	pageId = api.pageId || pageId;
	var baseId = pageId;
	for (var i = 2; usedIds[pageId]; i++) {
		pageId = baseId + '-' + i;
	}
	api.pageId = pageId;

	api.setupVar = api.pageId.replace(/[^a-z_]+/g, '_') + '_setup';

	if (api.params) api.params = filloutParams(api.params, pageId);
	if (api.return) api.return = filloutParams(api.return, pageId);
	api.api = [].concat(api.api || []);
	api.api.forEach(def => {
		def.args = [].concat(def.args || []);
		def.args = filloutParams(def.args, pageId);
		if (def.return) def.return = filloutParams(def.return, pageId)[0];
	});

	if (!api.title && api.api.length) {
		var map = {};
		var list = [], htmlList = [];
		api.api.forEach(def => {
			if (!map[def.function]) {
				map[def.function] = true;
				list.push(def.function);
				htmlList.push('<code>' + htmlEscape(def.function) + '()</code>');
			}
		});
		api.title = list.join(' / ');
		api.titleHtml = api.titleHtml || htmlList.join(' / ');
	}
	api.title = api.title || '(unknown)';
	api.titleHtml = api.titleHtml || htmlEscape(api.title);

	api.displayCode = api.displayCode || api.code;
	if (!api.code && !api.displayCode && api.api.length) {
		api.displayCode = api.code = defToCode(api.api[0]);
	}
	api.screenshot = [].concat(api.screenshot || []);

	api.children = [].concat(api.children || []);

	if (options.recursive) {
		api.children.forEach((child, index) => {
			var childId = child.pageId;
			if (!childId) {
				var suffix = child.title || (child.api && [].concat(child.api)[0].function) || (index + '');
				suffix = suffix.replace(/[^a-z0-9_]+/ig, '-').replace(/^\-+/, '').replace(/\-+$/, '').toLowerCase();
				childId = options.idPrefix + suffix + options.idSuffix;
			}
			filloutApi(child, childId, options, usedIds);
		});
	}
	return api;
}

function defToCode(def, includeDefaults) {
	var code = def.return ? (def.return.name || 'result') + ' = ' : '';
	code += def.function + '(' + def.args.map((arg, index) => {
		var code = arg.name || ('arg' + (index + 1));
		if (includeDefaults && 'default' in arg) {
			code += '=' + JSON.stringify(arg.default);
		}
		return code;
	}).join(', ') + ');';
	return code;
}

/********/

var jsfxDemoTemplate = `desc: ui-lib.jsfx-inc - API documentation
import ui-lib.jsfx-inc

in_pin:none
out_pin:none
options:want_all_kb

filename:0,themes/bitmap-simple/theme-cyan.png

@init
freemem = ui_setup(0);
api_buffer_length = 1024;
freemem = (api_buffer = freemem) + buffer_length;

@gfx 730 590
control_start("section-index", api_theme, api_theme_buffer);

function api_print_function_signature(code) (
	ui_split_top(18);
		ui_font("Courier New", 16, 1, 0);
		ui_text(code);
	ui_pop();
);

ui_screen() == "options" ? (
	control_dialog("Display options", "done");

	ui_split_topratio(1);
		ui_push_height(100);
			control_group("theme");
			ui_push_heighttext(-1);
				ui_split_leftratio(1/4);
					control_button("default", api_theme != "default") ? api_theme = "default";
				ui_split_next();
					control_button("tron", api_theme != "tron") ? api_theme = "tron";
				ui_split_next();
					control_button("black", api_theme != "black") ? api_theme = "black";
				ui_split_next();
					control_button("cyan (bitmap)", api_theme != "bitmap-simple" || api_theme_buffer != 0) ? (
						api_theme = "bitmap-simple";
						api_theme_buffer = 0;
					);
				ui_pop();
			ui_pop();
		ui_pop();
	ui_pop();
) : `;

function jsfxDemoCode(api) {
	var demoCode = jsfxDemoTemplate;

	function addScreen(api) {
		var pageId = api.pageId;
		demoCode += 'ui_screen() == ' + JSON.stringify(pageId) + ' ? (\n';
		demoCode += indent('control_navbar(' + JSON.stringify(api.title) + ', "options", "options");');
		demoCode += indent('ui_pad();\n');

		var displayText = api.text;
		var actualCode = api.code;
		var displayCode = api.displayCode || actualCode;
		if (!actualCode && !displayCode && api.api.length) {
			actualCode = defToCode(api.api[0]);
		}
		if (!displayCode && api.api.length) {
			displayCode = actualCode;
		}
		if (api.api.length) {
			if (api.api.length > 4) {
				var midPoint = Math.ceil(api.api.length/2);
				var firstHalf = api.api.slice(0, midPoint), secondHalf = api.api.slice(midPoint);
				demoCode += indent('ui_split_top(' + 18*midPoint + ');');
				demoCode += indent('ui_split_leftratio(0.5);', 2);
				firstHalf.forEach(def => {
					demoCode += indent('api_print_function_signature(' + JSON.stringify(defToCode(def, true)) + ');', 3);
				});
				demoCode += indent('ui_split_next();', 2);
				secondHalf.forEach(def => {
					demoCode += indent('api_print_function_signature(' + JSON.stringify(defToCode(def, true)) + ');', 3);
				});
				demoCode += indent('ui_pop();', 2);
				demoCode += indent('ui_pop();');
			} else {
				api.api.forEach(def => {
					demoCode += indent('api_print_function_signature(' + JSON.stringify(defToCode(def, true)) + ');');
				});
			}
			demoCode += indent('ui_padtop();\n');
		}

		var params = [].concat(api.params || (api.api[0] && api.api[0].args) || []);
		var returnParams = [].concat(api.return || (api.api[0] && api.api[0].return) || []);

		if (displayText) {
			demoCode += indent('ui_align(0, 0);');
			demoCode += indent('ui_padtop(ui_wraptext(' + JSON.stringify(api.text) + '));');
			demoCode += indent('ui_padtop(ui_texth());\n');
			demoCode += indent('ui_align(0.5, 0.5);');
		}

		if (actualCode) {
			demoCode += indent('ui_split_rightratio(0.5);');
			demoCode += indent('ui_padleft();', 2);

			if (params.length || returnParams.length) {
				demoCode += indent('!' + api.setupVar + ' ? (', 2);
				params.concat(returnParams).forEach(param => {
					var start = param.start || param.default;
					if (typeof start == 'number' && param.type !== 'text') {
						demoCode += indent(param.var + ' = ' + start + ';', 3);
					} else if (typeof start == 'object' && typeof start.code === 'string') {
						demoCode += indent(param.var + ' = ' + start.code + ';', 3);
					} else if (typeof start == 'string') {
						if (param.type === 'text') {
							demoCode += indent('strcpy(' + param.var + ', ' + JSON.stringify(start) + ');', 3);
						} else {
							demoCode += indent(param.var + ' = ' + JSON.stringify(start) + ';', 3);
						}
					}
				});
				demoCode += indent(api.setupVar + ' = 1;', 3);
				demoCode += indent(');', 2);
			}

			demoCode += indent(actualCode, 2);
			demoCode += indent('ui_pop();');
		}

		if (actualCode && (returnParams.length || params.length)) {
			if (returnParams.length) {
				returnParams.slice(0).reverse().forEach(returnParam => {

					demoCode += indent('ui_split_bottom(44);');
					demoCode += indent(`
ui_pad(-1, 0);
ui_split_leftratio(0.4);
	ui_align(1, 0.5);
	ui_text(` + JSON.stringify(returnParam.name + ': ') + `);
ui_pop();

ui_pad(0, -0.5);
control_background_inset();
ui_push();
	ui_padleft();
	ui_align(0, 0.5);
`, 2);

					if (returnParam.type == 'text') {
						demoCode += indent('ui_text(' + returnParam.var + ');', 3);
					} else {
						demoCode += indent('ui_textnumber(' + returnParam.var + ', ' + (returnParam.type === 'int' ? '"%i"' : '"%f"') + ');', 3);
					}
					demoCode += indent('ui_pop();', 2);
					demoCode += indent('control_finish_inset();', 2);
					demoCode += indent('ui_pop();');
				});
			}
			if (params.length) {
				var height = params.length*44 + 30;
				demoCode += indent('ui_split_bottom(' + height + ');');
				demoCode += indent('control_group("parameters");', 2);
				demoCode += indent('ui_split_topratio(1/' + params.length + ');', 2);
				params.forEach((param, paramIndex) => {
					if (paramIndex > 0) {
						demoCode += indent('ui_split_next();', 2);
					}
					demoCode += indent('ui_pad(0, -0.5);', 3);

					var start = param.start || param.default;
					demoCode += indent(`
ui_split_leftratio(0.4);
	ui_align(1, 0.5);
	ui_text(` + JSON.stringify(param.var + ': ') + `);
ui_pop();
`, 3);
					if (param.type === 'enum' && param.enum) {
						var options = [].concat(param.enum);
						var nextVar = pageId + '_param' + paramIndex + '_next';
						var prevVar = pageId + '_param' + paramIndex + '_prev';
						var textVar = pageId + '_param' + paramIndex + '_text';
						options.forEach((option, index) => {
							demoCode += indent((index > 0 ? ') : ' : '') + param.var + ' == ' + JSON.stringify(option) + ' ? (', 3);
							demoCode += indent(nextVar + ' = ' + JSON.stringify(options[(index + 1)%options.length]) + ';', 4);
							demoCode += indent(prevVar + ' = ' + JSON.stringify(options[(index - 1 + options.length)%options.length]) + ';', 4);
							demoCode += indent(textVar + ' = ' + JSON.stringify(option + "") + ';', 4);
						});
						demoCode += indent(');', 3);
						demoCode += indent(param.var  + ' = control_selector(' + [param.var, textVar, nextVar, prevVar].join(', ')  + ');', 3);
					} else if (param.type === 'text') {
						var stateVar = pageId + '_param' + paramIndex + '_state';
						demoCode += indent(stateVar  + ' = control_textinput(' + param.var + ', ' + stateVar + ');', 3);
					} else if (param.type === 'bool') {
						demoCode += indent(`
ui_split_left(60);
	` + param.var + ` = control_switch(` + param.var + `);
ui_pop();
ui_padright();
ui_align(1, 0.5);
ui_text(` + param.var + ` ? "on" : "off");`, 3);
					} else {
						var min = param.min || 0;
						var max = (param.max === 0 || param.max) ? param.max : start ? start : (typeof min === 'number' ? min + 1 : 1);
						demoCode += indent(`
ui_split_right(60);
	ui_align(0, 0.5);
	ui_textnumber(` + param.var + `, ` + (param.type === 'int' ? '"%i"' : '"%f"') + `);
ui_pop();
ui_padright();`, 3);
						if (typeof start === 'number') {
							demoCode += indent(param.var  + ' = control_slider_left(' + param.var + ', ' + min + ', ' + max + ', 0, ' + start + ');', 3);
						} else {
							demoCode += indent(param.var  + ' = control_slider_left(' + param.var + ', ' + min + ', ' + max + ', 0);', 3);
						}
						if (param.type == 'int') {
							demoCode += indent(param.var + ' = floor(' + param.var + ' + 0.5);', 3);
						}
					}
				});
				demoCode += indent('ui_pop();', 2);
				demoCode += indent('ui_pop();');
			}
		}
		if (displayCode) {
			demoCode += indent(`
ui_push();
	control_background_technical();
	ui_push_clip();
		ui_pad();
		ui_font("Courier New", 14, 1, 0);
		ui_align(0, 0.5);
		ui_text(` + JSON.stringify(displayCode) + `);
	ui_pop();
	control_finish_technical();
ui_pop();
	`);
		}
		if (!displayCode && !actualCode) {
			(api.children || []).forEach((child, index) => {
				demoCode += indent(`
ui_split_toptext(-1);
	ui_push_widthratio(0.5);
		control_button(` + JSON.stringify(child.title) + `) ? (
			ui_screen_open(` + JSON.stringify(child.pageId) + `);
			` + child.setupVar + ` = 0;
		);
	ui_pop();
ui_pop();`);
			});
		}
		demoCode += ') : ';

		(api.children || []).forEach((child, index) => {
			addScreen(child);
		});
	}

	addScreen(api);

	demoCode += 'control_system();';
	demoCode += '\n\n@serialize\nfile_var(0, api_theme);\n';
	return demoCode;
}

/*********/

var htmlTemplate = `<!DOCTYPE html>
<html>
	<head>
		<title>ui-lib.jsfx-inc API Documentation</title>
		<style>
			body {
				font-family: Tahoma, Verdana, Segoe, sans-serif;
				margin: 1em;
			}

			h2 {
				font-size: 1.5em;
				font-weight: normal;
				border-bottom: 1px solid #DDD;
			}

			h3 {
				font-size: 1.2em;
				font-weight: normal;
			}

			a[href] {
				text-decoration: none;
				color: #06D;
			}
			a:hover, a:active {
				text-decoration: underline;
			}
			a.self-link {
				text-decoration: none;
				color: inherit;
			}

			.back-link {
				float: right;
			}

			pre, code {
				/* https://cssfontstack.com/Lucida-Console */
				font-family: "Lucida Console", "Lucida Sans Typewriter", monaco, "Bitstream Vera Sans Mono", monospace;
				font-size: 13px;
				font-style: normal;
				font-variant: normal;
				font-weight: 400;
				line-height: 18.5714px;

				margin: 0;
				padding: 0;
			}
			h2 code {
				font-size: 0.9em;
			}

			section {
				max-width: 900px;
				margin: auto;
				margin-top: 3em;
			}

			.subsection {
				clear: both;
			}

			.children section {
				padding-left: 6%;
			}

			.code-example {
				padding: 1em 2em;
				background: #222;
				color: rgb(255, 192, 128);
				border-radius: 1em;
				box-shadow: 0px 0.5em 1em rgba(0, 0, 0, 0.5) inset;
			}

			.screenshots {
				text-align: center;
			}

			.screenshot {
				max-height: 50vh;
				margin: 0.5em;
				border-radius: 10px;
			}

			.screenshots-2 .screenshot {
				max-width: 45%;
			}
			.screenshots-3 .screenshot {
				max-width: 30%;
			}

			a .screenshot:hover {
				box-shadow: 0px 0px 1em rgba(0, 0, 0, 0.5);
			}

			.definitions {
			}

			.definition {
				margin: 0.5em 0;
			}

			.definition-permalink {
				float: right;
			}

			.function-type-int, .function-type-pointer {
				color: #0A0;
			}
			.function-type-number {
				color: #04B;
			}
			.function-type-enum, .function-type-id {
				color: #B0B;
			}
			.function-type-bool {
				color: #B70;
			}
			.function-type-text {
				color: #B00;
			}
		</style>
	</head>
	<body>`;

function bodyHtml(api, options) {
	var functionIndex = [];
	function sectionHtml(api, options, level, parentId) {
		var html = '<section id="' + htmlEscape(api.pageId) + '">\n';
		if (parentId) {
			html += indent('<a class="back-link" href="#' + htmlEscape(parentId) + '">⇧</a>');
		}
		html += indent('<h2><a class="self-link" href="#' + htmlEscape(api.pageId) + '">' + api.titleHtml + '</a></h2>');

		if (api.api.length) {
			html += indent('<div class="definitions">');
			api.api.forEach(def => {
				var codeHtml = '';
				codeHtml += '<span class="function-name">' + htmlEscape(def.function) + '</span>(';
				codeHtml += def.args.map(arg => {
					var argClass = 'function-arg';
					if (arg.type) argClass += ' function-type-' + arg.type;
					var argHtml = '<span class="' + htmlEscape(argClass) + '">' + htmlEscape(arg.name) + '</span>';
					if (arg.default != null) {
						argHtml += '=' + JSON.stringify(arg.default);
					}
					return argHtml;
				}).join(', ');
				codeHtml += ')';
				var definitionHtml = codeHtml;

				if (def.return) {
					var argClass = 'function-return';
					if (def.return.type) argClass += ' function-type-' + def.return.type;
					codeHtml = '<span class="' + htmlEscape(argClass) + '">' + htmlEscape(def.return.name) + '</span> = ' + codeHtml;
				}

				var functionId = 'api-' + def.function + '-' + def.args.length;

				html += '<a class="definition-permalink" href="#' + htmlEscape(functionId) + '">#</a>';
				html += indent('<pre class="definition" id="' + htmlEscape(functionId) + '"><code>' + codeHtml + '</code></pre>', 2);

				functionIndex.push({def: def, html: definitionHtml, id: functionId});
			});
			var args = [], argsHandled = {};
			api.api.forEach(def => {
				args = args.concat(def.args);
			});
			api.api.forEach(def => {
				args = args.concat(def.return || []);
			});
			if (args.length) {
				html += indent('<div class="subsection">', 2)
				html += indent('<ul class="function-arg-list">', 3);
				args.forEach(arg => {
					if (argsHandled[arg.name] === true) return;
					argsHandled[arg.name] = true;
					var argClass = 'function-arg';
					if (arg.type) argClass += ' function-type-' + arg.type;
					var argHtml = '<code class="' + htmlEscape(argClass) + '">' + htmlEscape(arg.name) + '</code>';
					var descHtml = '';
					if (arg.type === 'id') {
						descHtml += 'an identifier';
					} else if (arg.type === 'bool') {
						descHtml += 'boolean';
					} else if (arg.type === 'text') {
						descHtml += '';
					} else if (arg.type === 'pointer') {
						descHtml += 'index in the memory array';
					} else if (arg.type === 'int') {
						descHtml += 'integer';
					} else if (arg.type === 'enum' && arg.enum) {
						descHtml += [].concat(arg.enum).map((value, index) => {
							value = htmlEscape(JSON.stringify(value));
							if (index > 0) {
								if (index == arg.enum.length - 1) {
									value = ' or ' + value;
								} else {
									value = ', ' + value;
								}
							}
							return value;
						}).join('');
					}
					if (typeof arg.min === 'number') {
						if (typeof arg.max == 'number') {
							descHtml += ' between ' + arg.min + ' and ' + arg.max;
						} else {
							descHtml += ' >= ' + arg.min;
						}
					} else if (typeof arg.max == 'number') {
						descHtml += ' <= ' + arg.max;
					}
					if (arg.html) {
						if (descHtml) {
							descHtml = arg.html + ', ' + descHtml;
						} else {
							descHtml = arg.html;
						}
					}
					if (descHtml) {
						argHtml += ' - ' + descHtml;
					}
					html += indent('<li>' + argHtml + '</li>', 4);
				});
				html += indent('</ul>', 3);
				html += indent('</div>', 3);
			}
			html += indent('</div>');
		}

		if (api.html) {
			html += indent('<div class="about">');
			html += indent(api.html, 2);
			html += indent('</div>');
		}
		if (api.displayCode || api.screenshot.length) {
			html += indent('<div class="subsection"><h3>Example:</h3>')
			if (api.displayCode) {
				html += '<pre class="code-example"><code>' + api.displayCode + '</code></pre>\n';
			}
			if (api.screenshot.length) {
				var columns = Math.min(3, api.screenshot.length);
				var rows = Math.ceil(api.screenshot.length/columns);
				columns = Math.ceil(api.screenshot.length/rows);
				html += indent('<div class="screenshots screenshots-' + columns + '">', 2)
				api.screenshot.forEach(url => {
					url = options.imagePrefix + url;
					html += indent('<a href="' + htmlEscape(url) + '" target="_blank"><img class="screenshot" src="' + htmlEscape(url) + '"></a>', 3);
				});
				html += indent('</div>', 2);
			}
			html += indent('</div>');
		}

		if (api.children.length) {
			html += indent('<ul class="child-links">');
			api.children.forEach(child => {
				html += indent('<li><a href="#' + htmlEscape(child.pageId) + '">' + child.titleHtml + '</a></li>', 2);
			});
			html += indent('</ul>');
			html += indent('<div class="children">');
			api.children.forEach(child => {
				// We unfortunately cannot indent this, unless we do something smarter with <pre>
				html += sectionHtml(child, options, level + 1, api.pageId);
			});
			html += indent('</div><!-- children for ' + api.pageId + '-->');
		}
		html += '</section>\n';
		return html;
	}

	var mainHtml = sectionHtml(api, options, 0, null);

	var tocHtml = '<nav>' + (function toc(api) {
		if (!api.children.length) return '';
		return '<ol>' + api.children.map(child => {
			return '<li><a href="#' + htmlEscape(child.pageId) + '">' + child.titleHtml + '</a>' + toc(child) + '</li>';
		}).join('') + '</ol>';
	})(api) + '</nav>\n';

	functionIndex.sort((a, b) => {
		return a.def.function < b.def.function ? -1 : 1;
	});
	var indexHtml = functionIndex.map(fn => {
		return '<a href="#' + htmlEscape(fn.id) + '"><pre class="definition-index"><code>' + fn.html + '</code></pre></a>';
	}).join('\n');

	var html = htmlTemplate + mainHtml + '\t</body>\n</html>';
	return html;
}

/*********/

var fs = require('fs'), path = require('path');
var api = JSON.parse(fs.readFileSync(__dirname + '/api.json', 'utf8'));
api = filloutApi(api, 'section-index', {idPrefix: 'section-', recursive: true});

// Write JSFX

var demoCode = jsfxDemoCode(api);

var libCode = fs.readFileSync(__dirname + '/../ui-lib.jsfx-inc');
var directories = [__dirname + '/jsfx'];
if (process.argv[2]) {
	directories.push(process.argv[2]);
}
directories.forEach(directory => {
	fs.writeFileSync(path.join(directory, 'ui-lib.jsfx-inc'), libCode);
	fs.writeFileSync(path.join(directory, 'ui-lib-api-docs.jsfx'), demoCode);
	console.log('wrote to: ' + directory);
});

// Write HTML

var pageHtml = bodyHtml(api, {imagePrefix: '../'});
var htmlFile = __dirname + '/html/index.html';
fs.writeFileSync(htmlFile, pageHtml);
console.log('wrote to: ' + htmlFile);
