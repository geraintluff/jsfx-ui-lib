var fs = require('fs'), path = require('path');

var libCode = fs.readFileSync(__dirname + '/../ui-lib.jsfx-inc');

var demoCode = `desc: ui-lib.jsfx-inc - API documentation
import ui-lib.jsfx-inc

in_pin:none
out_pin:none
options:want_all_kb

@init
freemem = ui_setup(0);

@gfx 690 550
control_start("page", api_theme);

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
				ui_split_leftratio(1/3);
					control_button("default", api_theme != "default") ? api_theme = "default";
				ui_split_next();
					control_button("tron", api_theme != "tron") ? api_theme = "tron";
				ui_split_next();
					control_button("black", api_theme != "black") ? api_theme = "black";
				ui_pop();
			ui_pop();
		ui_pop();
	ui_pop();
) : `;

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
	[].concat(params).forEach((param, index) => {
		param.name = param.name || ('arg' + (index + 1));
		if (param.type == 'text' && param.name[0] !== '#') {
			param.name = '#' + param.name;
		}
		param.var = param.var || param.name;
		if (param.type === 'boolean') param.type = 'bool';
		if (param.type === 'integer') param.type = 'int';
	});
}

function filloutApi(api, pageId) {
	api.pageId = api.pageId || pageId;
	api.setupVar = api.setupVar = api.pageId + '_setup';

	if (api.params) filloutParams(api.params, pageId);
	if (api.return) filloutParams(api.return, pageId);
	api.api = [].concat(api.api || []);
	api.api.forEach(def => {
		def.args = [].concat(def.args || []);
		def.args.forEach(arg => filloutParams(arg, pageId));
		if (def.return) filloutParams(def.return, pageId);
	});

	if (!api.title && api.api.length) {
		var map = {};
		var list = [];
		api.api.forEach(def => {
			if (!map[def.function]) {
				map[def.function] = true;
				list.push(def.function);
			}
		});
		api.title = list.join(' / ');
	}
	api.title = api.title || '(unknown)';
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

function addScreen(api) {
	filloutApi(api);
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
				} else if (typeof start == 'string') {
					if (param.type === 'text') {
						demoCode += indent('strcpy(' + param.var + ', ' + JSON.stringify(start) + ');', 3);
					} else {
						demoCode += indent(param.var + ' = ' + start + ';', 3);
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
				if (param.type === 'text') {
					var stateVar = pageId + '_param' + paramIndex + '_state';
					demoCode += indent(stateVar  + ' = control_textinput(' + param.var + ', ' + stateVar + ');', 3);
				} else if (param.type === 'bool') {
					demoCode += indent(`
ui_split_left(60);
	` + param.var + ` = control_switch(` + param.var + `);
ui_pop();
ui_padright();
ui_align(1, 0.5);
ui_text(` + param.var + ` ? "on" : "off");
`, 3);
				} else {
					var min = param.min || 0;
					var max = (param.max === 0 || param.max) ? param.max : start ? start : (typeof min === 'number' ? min + 1 : 1);
					demoCode += indent(`
ui_split_right(60);
	ui_align(0, 0.5);
	ui_textnumber(` + param.var + `, ` + (param.type === 'int' ? '"%i"' : '"%f"') + `);
ui_pop();
ui_padright();`, 3);
 					demoCode += indent(param.var  + ' = control_hslider(' + param.var + ', ' + min + ', ' + max + ', 0);', 3);
					if (param.type == 'int') {
						demoCode += indent(param.var + ' = floor(' + param.var + ' + 0.5);', 3);
					}
					if (typeof start === 'number') {
						demoCode += indent('ui_click() && ui_clickcount() == 2 ? ' + param.var + ' = ' + start + ';', 3);
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
	ui_push();
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
			filloutApi(child, pageId + '_' + index);
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

var api = require('./api.json');
filloutApi(api, "page");
addScreen(api);
demoCode += 'control_system();';
demoCode += '\n\n@serialize\nfile_var(0, api_theme);\n';

var directories = [__dirname + '/demo'];
if (process.argv[2]) {
	directories.push(process.argv[2]);
}
directories.forEach(directory => {
	fs.writeFileSync(path.join(directory, 'ui-lib.jsfx-inc'), libCode);
	fs.writeFileSync(path.join(directory, 'ui-lib-api-docs.jsfx'), demoCode);
	console.log('wrote to: ' + directory);
});
