var fs = require('fs'), path = require('path');

var libCode = fs.readFileSync(__dirname + '/../ui-lib.jsfx-inc');

var demoCode = `desc: ui-lib.jsfx-inc - API documentation
import ui-lib.jsfx-inc

in_pin:none
out_pin:none
options:want_all_kb

@init
freemem = ui_setup(0);

@gfx 690 500
control_start("page", api_theme);

ui_split_bottomtext(-1);
	ui_split_rightratio(1/3);
		ui_split_right(120);
			!api_theme ? api_theme = "default";
			api_theme === "tron" ? (
				api_theme_next = "black";
				api_theme_prev = "default";
			) : api_theme === "black" ? (
				api_theme_next = "default";
				api_theme_prev = "tron";
			) : (
				api_theme_next = "tron";
				api_theme_prev = "black";
			);
			api_theme = control_selector(api_theme, api_theme, api_theme_next, api_theme_prev);
		ui_pop();

		ui_align(0.8, 0.5);
		ui_text("Theme:");
	ui_pop();
ui_pop();

`;

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
	});
}

function filloutApi(api, pageId) {
	api.pageId = api.pageId || pageId;
	api.title = api.title || (api.api && (api.api.function + "()")) || '(unknown)';
	api.setupVar = api.setupVar = api.pageId + '_setup';

	if (api.params) filloutParams(api.params, pageId);
	if (api.return) filloutParams(api.return, pageId);
	if (api.api && api.api.args) api.api.args.forEach(arg => filloutParams(arg, pageId));
	if (api.api && api.api.return) filloutParams(api.api.return, pageId);
}

function addScreen(api) {
	filloutApi(api);
	var pageId = api.pageId;
	demoCode += 'ui_screen() == ' + JSON.stringify(pageId) + ' ? (\n';
	demoCode += indent('control_navbar(' + JSON.stringify(api.title) + ');');
	demoCode += indent('ui_pad();\n');
	demoCode += indent('ui_align(0, 0);');

	var displayText = api.text;
	var actualCode = api.code;
	if (!actualCode && api.api) {
		actualCode = api.api.return ? (api.api.return.name || 'result') + ' = ' : '';
		actualCode += api.api.function + '(' + api.api.args.map((arg, index) => {
			return arg.name || ('arg' + (index + 1));
		}).join(', ') + ');';
	}
	var displayCode = api.displayCode || actualCode;
	var params = [].concat(api.params || (api.api && api.api.args) || []);
	var returnParams = [].concat(api.return || (api.api && api.api.return) || []);

	if (displayText) {
		demoCode += indent('ui_padtop(ui_wraptext(' + JSON.stringify(api.text) + '));');
		demoCode += indent('ui_padtop(ui_texth());\n');
	}
	demoCode += indent('ui_align(0.5, 0.5);');

	if (actualCode) {
		demoCode += indent('ui_split_rightratio(0.5);');
		demoCode += indent('ui_padleft();', 2);
		demoCode += indent(actualCode, 2);
		demoCode += indent('ui_pop();');
	}
	if (displayCode) {
		if (returnParams.length) {
			returnParams.slice(0).reverse().forEach(returnParam => {
				var start = returnParam.start || returnParam.default;
				if (typeof start == 'number' && returnParam.type !== 'text') {
					demoCode += indent('!' + api.setupVar + ' ? ' + returnParam.var + ' = ' + start + ';', 3);
				} else if (typeof start == 'string') {
					demoCode += indent('!' + api.setupVar + ' ? strcpy(' + returnParam.var + ', ' + JSON.stringify(start) + ');', 3);
				}

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
					demoCode += indent('ui_text(' + returnParam.var + ', "%f");', 3);
				} else {
					demoCode += indent('ui_textnumber(' + returnParam.var + ', "%f");', 3);
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
				if (typeof start == 'number' && param.type !== 'text') {
					demoCode += indent('!' + api.setupVar + ' ? ' + param.var + ' = ' + start + ';', 3);
				} else if (typeof start == 'string') {
					demoCode += indent('!' + api.setupVar + ' ? strcpy(' + param.var + ', ' + JSON.stringify(start) + ');', 3);
				}
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
ui_align(0, 0.5);
ui_padleft();
ui_text(` + param.var + ` ? "on" : "off");
`, 3);
				}
			});
			demoCode += indent('ui_pop();', 2);
			demoCode += indent(api.setupVar + ' = 1;', 2);
			demoCode += indent('ui_pop();');
		}
		demoCode += indent(`
ui_push();
	control_background_technical();
	ui_push();
	ui_pad();
		ui_font("Courier New", 12, 1, 0);
		ui_align(0, 0.5);
		ui_text(` + JSON.stringify(displayCode) + `);
	ui_pop();
	control_finish_technical();
ui_pop();
`);
	} else {
		demoCode += indent('ui_padtop();\n');
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
