# `ui-lib.jsfx-inc`: easy UIs for REAPER's JS effects

This is a library/framework for creating UIs in REAPER's JSFX language in a straightforward way.

It requires REAPER v4.60 or above.

The best way to get started is [**this guide**](tour/), which explains how the library works, using code examples and screenshots.  Once you've gone through that, hopefully the API docs below will make sense.

## Features

*	Flexible layouts
*	Built-in controls
	*	buttons
	*	sliders
	*	dials
	*	selectors
	*	text-input boxes
*	Multiple screens (including argument-passing)
*	Themes ([default](demo/theme-default.png), [black](demo/theme-black.png), [tron](demo/theme-tron.png))

![screenshot](demo/theme-default.png)

# API Reference

Here is the full API reference.  It is recommended you start with the [**guided tour**](tour/)

## Setup

### `ui_setup(memstart)`

This must be called in `@init`.  It reserves a section of the memory buffer for use by the UI library.  It returns the next index that it is not using.

```
// Let's say we have a section reserved to to FFTs in
fft_buffer = 0;
fft_buffer_end = fft_buffer + 512;

// Set up the UI library
safe_to_use = ui_setup(fft_buffer_end, 10, 10);

// It lets us know how much space it uses
next_array_start = safe_to_use;
```

If you are not using the memory buffer for anything else, then the first argument should be `0`.

### `ui_start(defaultScreen)`

This should be the first thing you call in `@gfx`.  It resets the viewport, does some error-checking, detects clicks - generally important. :)

If the screen is not set (`0`), it is set to `defaultScreen`.

## Screen management functions

### `ui_screen()`

Gets the current screen ID.  You should check this to see what you should be drawing:

```
ui_start("main"); // Default screen

ui_screen() == "main" ? (
	...
) : ui_system();
```

Although there is a string in the above example, screen IDs are always compared numerically.  However, two identical string literals will be represented by the same numerical ID, it's a nice readable way to get a set of unique IDs.

You must *always* perform the `ui_screen()` check, even if you only have one screen, so that `ui_system()` can be used to display errors etc.

There are some built-in screen IDs which are handled by ui_system();

### `ui_screen_open(id)`

Opens the screen with the given ID.

### `ui_screen_close()` and `ui_screen_close_id(id)`

Closes the a screen.  `ui_screen_close_id()` only closes the screen if the ID matches, which helps prevent closing screens under you if it ends up called twice.  It is recommended that you use `ui_screen_close_id()` where that is known.

### `ui_screen_close_to(id)`

Closes screens until the either the screen ID matches `id`, or the top level is reached.

### `ui_screen_get(index)` and `ui_screen_set(index, value)`

Gets/sets the current screen argument at index `index`.

This is how screens can "call" each other with arguments.  You need a convention agreed between the screens about what the arguments are.  When a screen is opened, all arguments are set to 0.

```
ui_screen_open("say-hello");
ui_screen_set(0, "world");
ui_screen_set(1, 42);
```

If you want the screen to give you a result to a non-fixed location, then you need to pass in an array.  For example, a "integer-prompt" screen might take two arguments as the range, and the other as the memory index ("array") where the result should be placed.

```
// A text variable you're interested in
myarray[0] = 5; // default value

ui_screen_open("integer-prompt");
ui_screen_set(0, 1);
ui_screen_set(1, 10);
ui_screen_set(2, myarray);
```

### `ui_screen_level()`

Returns how many screens are below this one in the stack

### `ui_system()`

This is the fallback function you must call if you have not rendered a screen.  It displays errors and other built-in screens.

You should always have this - since JSFX has no exceptions or error-handling, this is way you'll be informed if you tell the UI to do something nonsensical.

## Viewport and stack operations

All drawing parameters (including the viewport, colours and alignment) are stored in a "stack".  Generally, you will made a modification that pushes a change onto the stack, and then pop it off afterwards.

Some operations (such as the `ui_split_*()` functions) both modify the existing level on the stack, *and* push a new layer to it.  This is often convenient - for example, if your UI has a side-bar, you can use `ui_split_right(100)` to push it onto the stack and draw within it, but when you `ui_pop()` afterwards, you are left with the *remaining* area (that is, the viewport has now shrunk so it doesn't include the side-bar).

### `ui_left()`, `ui_right()`, `ui_top()`, `ui_bottom()`, `ui_width()` and `ui_height()`

These return the dimensions of the current viewport - very useful if you need to draw your own stuff and want to know what the viewport is.

### `ui_pop()` (and `ui_push()`)

Pop a layer off the stack, or push a new layer (identical to the current one).

You probably don't need to use `ui_push()` directly - instead, many of the other functions call `ui_push()` as a side-effect.

### `ui_split_top(height)`, `ui_split_bottom(height)`, `ui_split_left(width)` and `ui_split_right(width)`

These perform two actions:

* Push a new layer onto the stack, with the viewport attached to the appropriate side
* Modify the existing layer (now second on the stack) so that it no longer includes the new section.

It's called "split" because the two layers on the stack are now non-overlapping.

```
ui_split_bottom(100);
	ui_border_top();
	ui_text("footer");
ui_pop();
// Viewport is now everything *except* the footer
ui_color(64, 64, 64);
ui_fill(); // Does not overwrite the footer
```

### `ui_split_topratio(ratio)`, etc.

These are the same as `ui_split_top()` etc., except instead of a pixel height you specify a ratio of the current viewport width/height.

The return value of this function is the calculated height/width.

### `ui_split_toptext(text)`, etc.

These are the same as `ui_split_top()` etc., except it measures the supplied text, plus some amount of padding.  This is a useful way to get a default height/width for buttons and controls.

(If you pass an empty string to `ui_split_toptext()` or `ui_split_bottomtext()`, it will still return a minimum height of one line (plus padding), but there is no minimum width for `ui_split_lefttext()` or `ui_split_righttext()`.  However, measuring the empty string has some odd side-effects, so it's best to actually provide some text.)

The return value of this function is the calculated height/width.

### `ui_split_next()`

Pop a layer off the stack, and perform the same split again.  This can be used with `ui_split_*ratio()` to divide the space up evenly:

```
ui_split_topratio(1/3);
	ui_text('Line 1');
ui_split_next();
	ui_text('Line 2');
ui_split_next();
	ui_text('Line 3');
ui_pop();
```

Calling `ui_split_next()` when the current layer was not created by `ui_split_*()` results in an error.

### `ui_push_height(height)` and `ui_push_width(width)`

Push a new alignment state to the stack with the specified height/width, using the current alignment.

For example, if your alignment is central (`ui_align(0.5, 0.5)`) and you call `ui_push_height(50)`, then it will push a new viewport onto the stack, occupying the middle 50px of the previous viewport.

### `ui_push_heightratio(ratio)` and `ui_push_widthratio(ratio)`

Like `ui_push_height(height)` and `ui_push_width(width)`, but specifying a proportion of the height/width;

The return value of this function is the calculated height/width.

### `ui_push_heighttext(text)` and `ui_push_widthtext(text)`

Like `ui_push_height(height)` and `ui_push_width(width)`, but measures the supplied text, plus some amount of padding.

Similarly to `ui_split_toptext()` and `ui_split_bottomtext()`, if you pass in an empty string, it will still return the minimum height of one line (plus padding).  There is no minimum width for `ui_push_width

The return value of this function is the calculated height/width.

### `ui_push_above(height)`, `ui_push_below(height)`, `ui_push_leftof(width)` and `ui_push_rightof(width)`

These functions are the counterparts of `ui_push_height()` and `ui_push_width()` to a certain extent.  They push a new viewport that is above/below/left/right of the viewport that would be produced by `ui_push_width()` or `ui_push_height()`.

This lets you position content using `ui_push_height()` and `ui_push_width()` or other means, and then fit other content around that.  `ui_push_above()` and `ui_push_below()` can also be useful when used after `ui_wraptext()`, which again returns the height of the wrapped text.

### `ui_push_aboveratio(ratio)`, `ui_push_abovetext(text)`, etc.

You should by this point be able to guess what these functions do. :)

### `ui_pad()`

`ui_pad()` pads by a default amount in each direction.  This amount can be set using `ui_padding()`.

### `ui_padleft()`, `ui_padright()`, `ui_padtop()` and `ui_padbottom()`

Pads in one direction only, with the default padding.

### `ui_pad1(pixels)`, `ui_pad2(xpixels, ypixels)`, `ui_pad4(left, top, right, bottom)`

This insets the current viewport by an appropriate amount in each direction.  The three numbered variants are for different numbers of arguments.  If any of the padding values is `-1`, the default padding for that direction is used.

It does *not* change the stack.

### `ui_padding(hpadding, vpadding);`

This sets the default padding for each direction.  If you supply `-1` for either, the padding in that direction is unchanged.

## Graphics

These do not add or remove anything to the stack.  Instead, they modify the current drawing layer (and any later layers that inherit from it).

### `ui_color(r, g, b)`

Sets the current colour, full opacity.  RGB values are in the 0-255 range.

### `ui_colora(r, g, b, a)`

Sets the current colour, variable opacity.  RGB values are in the 0-255 range, but opacity is 0-1.

### `ui_color_refresh()`

Ensures that the current raw colour settings (`gfx_*` variables) match the current colour.  You only need this if you are drawing things yourself, and you do not need to call this if you have just called `ui_color()`.

### `ui_fontsize(pixels)`, `ui_fontbold(isBold)`, `ui_fontitalic(isItalic)` and `ui_fontface(name)`

Changes properties of the font.  These changes have immediate effect.

The UI library always uses font index 16, so it is recommended that you avoid this in custom drawing code.  If you make changes to this font index, then the UI system might not notice, and will draw incorrectly.  However, if you use a different font index, the UI system checks this before drawing text and will reset.

### `ui_font(name, size, isBold, isItalic)`

Composite function for the above operations.  If `-1` is supplied to either `name` or `size`, it re-uses the current font name/size.

### `ui_font_refresh()`

This ensures that the current raw font settings (`gfx_setfont()`) match the font values.  You only need this if you are drawing things yourself (e.g. using `gfx_drawstr()`), and you do not need to call this if you've just called `ui_font()`.  This also calls `ui_color_refresh()`.

### `ui_align(halign, valign)`

Some operations (like text) need a horizontal/vertical alignment.  These are numbers between 0 and 1 representing the alignment - so `0` means "left" or "top", `0.5` is "centre", and `1` is "right" or "bottom".

The default alignment is `(0.5, 0.5)`, which is the middle.

### `ui_text(string)`

Renders a string aligned within the current element.

Returns the width of the rendered text;

### `ui_text_width(string)` and `ui_text_height(string)`

String width and height using the current font settings.

### `ui_wraptext(string)`

Renders wrapped text (breaks on whitespace), aligned within the current element.

Returns height of the rendered text.

### `ui_wraptext_height(string)`

Height of wrapped text using the current font settings.

### `ui_fill()`

Fills the current viewport with the current colour.

## Mouse

### `ui_interacted()`

Whether the user recently interacted with the UI using the mouse or keyboard.  This can be checked (at the end of the `@gfx` block, or elsewhere) to perform recalculations (similar to the `@slider` block).

### `ui_mouse_x()` and `ui_mouse_y()`

Mouse position relative to current viewport.

### `ui_mouse_xratio()` and `ui_mouse_yratio()`

Mouse position as proportion of current viewport.  If the mouse is outside the current viewport, this value will be outside of the range 0-1.

### `ui_mouse_down()`

Returns whether the mouse was just pressed inside the current viewport.

### `ui_mouse_down_outside()`

Returns whether the mouse was just pressed outside the current viewport.

### `ui_mouse_up()`

Returns whether the mouse was just released inside the current viewport.

### `ui_click_clear()`

You probably shouldn't have overlapping click regions - but if you do you can use `ui_click_clear()` to stop later code from detecting it.  No mouse-related functions will return true in later code.

### `ui_hover()`

Whether the mouse is currently inside the viewport.

Note: this returns true even if the mouse buttons are down or the user has clicked somewhere else and is dragging.

### `ui_press()`

Whether the mouse was originally clicked within this viewport, the button is still down and the user is hovering over this element.  It returns the time since the mouse was originally clicked.

Note: if the user holds the mouse down and drags outside the control and then back into it, this will return true.

### `ui_click()`

Whether this element was clicked.  It returns the duration of the click.

Note: this triggers on mouse-up (which also means that drag and press will return false at this point).  If you want mouse-down, use `ui_mousedown()`.

### `ui_clickcount()`

Returns whether the latest click was a single-click, double-click, etc.

```
ui_click() ? (
	ui_clickcount == 1 ? (
		single_click_action();
	) : ui_clickcount == 2 ? (
		double_click_action();
	);
);
```

### `ui_drag()`

Whether this element was clicked before and the mouse is still down.  It returns the time since the mouse was originally clicked.

Note: this does not start returning true immediately after mouse-down - it waits either a short amount of time, or until the mouse has moved a bit.  If you want an immediate response, you should check `ui_mouse_down()` or `ui_press()` as well.

### `ui_drag_x()` and `ui_drag_y()`

The distance (relative to mouse-down) the mouse has been dragged in each direction since mouse-down.

### `ui_drag_xdelta()` and `ui_drag_ydelta()`

The distance (relative to mouse-down) the mouse has been dragged in each direction since the last frame.

### `ui_scroll_x()` and `ui_scroll_y()`

Whether the scroll-wheel has moved, and the mouse is inside the current viewport.

## Keyboard

REAPER's native `gfx_getchar()` function pops a character off the queue every time it's called - this is awkward if more than one control might be interested in the key's value.

When dealing with the keyboard, the concept of "focus" is relevant.  Controls should not assume they are focused (paying attention to keypress events) unless they have been clicked.  They should also listen for clicks outside themselves (using `ui_mouse_down_outside()`) and become unfocused.

In a given frame, if no keys were consumed (using `ui_key_next()`), the first key is discarded so a different one can be tried next frame.

### `ui_key()`

Returns the latest key code.  If no keys more are queued up, it returns `0`.

### `ui_key_next()`

Consumes the current key, and returns the next one (or `0` if there are none).

### `ui_key_printable()`

Returns `ui_key()` if the value is a printable character (32-127), `0` otherwise.

## Drawing utilities

### `ui_graph(buffer, length, y_low, y_high)`

This plots the values in the buffer using the current colour, scaled to the current viewport.

The arguments `y_low` and `y_high` specify the range of the graph.  If they are equal, then the graph is auto-scaled, keeping that value in the centre.

### `ui_graph_step(buffer, count, step, y_low, y_high)`

Same as `ui_graph()`, except it steps across the buffer instead of plotting all the values.

Useful for real/imaginary plots, e.g.:

```eel2
// Buffer is 256 complex pairs = 512 elements long
control_background_technical();
ui_color(192, 128, 64);
ui_graph_step(buffer, 256, 2, -1, 1); // real
ui_color(64, 128, 192);
ui_graph_step(buffer + 1, 256, 2, -1, 1); // imaginary
```

## Complex controls

These are controls implemented using the above functions.  They are opinionated - they have fixed colours and layouts.  However, they can be used to create a powerful UI more easily.

There are also some pre-defined screens which are made available if you use `control_system()` instead of `ui_system()`:

*	`control.prompt` - takes two arguments
	*	argument `0`: the string to edit
	*	argument `1`: title of the prompt
	
### `control_start(default_screen, theme)`

This is a replacement for `ui_start()` that includes a second argument to select a theme.  Themes are identified by string constants, and the current themes are `"default"` and `"black"`.  Any unrecognised theme is treated as `"default"`.

### `control_navbar(title, next_title, next_screen)`

Displays a navigation bar for the screen with a centred title, and "back" button if the screen is not top-level.  If `next_screen` is supplied, it displays a button on the right-hand side for navigating to the next page.

The "back" button will automatically close the current screen.

### `control_dialog(title, width, height, text_ok, text_cancel)`

Displays a dialog.  It returns the acceptance state of the dialog:

*	`0` - the dialog has not been closed
*	`1` - the dialog was just closed by clicking "OK"
*	`-1` - the dialog was just closed by clicking "cancel"

Note, if `1` or `-1` is returned, the screen containing the dialog has _already been closed_ (much like the "back" button of `control_navbar()`) so you do not need to close this yourself.

If `width` or `height` are `-1`, then default values are used.

If `text_cancel` is `-1`, the dialog has no cancel button.  If `text_ok` is `-1`, the dialog has no OK button.

### `control_button(text)`

Displays a button with text, and returns `true` if the button has just been clicked.

```
control_button("Go!") ? (
	do_something();
);
```

### `control_indicator_button(text, enabled)`

Displays a button that can be disabled (greyed-out).

```
control_button("Go!", is_enabled) ? (
	is_enabled ? do_something();
);
```

Note that it will still return positive when clicked, even if the button is disabled, so you should check again before performing an action.

### `control_readout(text)`

Displays the text in an inset box.  Useful to indicate values that are variable, but are changed through a different part of the interface (e.g. another screen).

### `control_group(title)`

Displays a bordered section with a title embedded in the border - useful for grouping controls by theme.

### `control_selector(value, text, up_value, down_value)`

Displays a control with up/down buttons and a text area, to choose between a fixed number of options.  Returns the new value.

```
// Displays a control that changes between foo/bar/baz
display_text = value == 1 ? "foo" : value == 2 ? "bar" : "baz";
value = control_selector(value, display_text, (value + 1)%3, (value + 2)%3);
```

### `control_hslider(value, range_low, range_high, curve_bias)` and `control_vslider(...)`

Displays a horizontal/vertical slider.  Returns the new value.

The value of `curve_bias` determines how the displayed proportion of the slider corresponds to the actual values. `0` is linear, and you can get a logarithmic scale using `log(high/low)`:

```
// Linear slider between 0 and 1
value = control_hslider(value, 0, 1, 0);

// Low-biased slider (better accuracy near 0)
value = control_hslider(value, 0, 1, 3);

// High-biased slider (better accuracy near 1)
value = control_hslider(value, 0, 1, -3);

// Logarithmic slider
value = control_hslider(value, low, high, log(high/low));
```

### `control_dial(value, range_low, range_high, curve_bias)`

Displays a circular dial.  Returns the new value.

This dial uses the "enabled" colour.  If you want to display text within the dial (in the centre), use `control_color_text_enabled()`.

### `control_dial_angle(angle)`

Displays a circular dial that rotates a full circle.  `angle` is the current value (in radians) and the new value is returned (cast to the range between `0` and `2π`).

### `control_textinput(string, inputstate)`

Displays a single-line text input box for editing a string.

`inputstate` is an opaque value representing the state of the text input.  You must keep this state and pass it back to the input every time:

```
// Two independent text inputs
ui_split_toptext(-1);
	input1state = control_textinput(string1, input1state);
ui_split_next();
	input2state = control_textinput(string2, input2state);
ui_pop();
```

The initial value for this (upon loading a screen) should be `0`.

NOTE: in order to capture all keypresses (e.g. so that the space bar gets routed to the effect instead of starting/stopping playback), you'll need to put `options:want_all_kb` in the header of your effect.

### `control_textinput_hasfocus(inputstate)`

Inspects the state to see whether it currently focused or not.

### `control_textinput_focus(inputstate)`

This alters the input state to set the input to be focused.

**Warning:** this does not take the focus *away* from any other inputs - you must do that yourself.

### `control_textinput_unfocus(inputstate)`

This alters the input state to set the input to be unfocused.

### `control_system()`

This is a replacement for `ui_system()` that includes some built-in screens:

*	`"control.prompt"` - text prompt to edit a single value.  Arguments are:
	*	`0` - the string to edit (must be mutable - see the [JSFX documentation](http://www.reaper.fm/sdk/js/strings.php#js_strings) for what that means).
	*	`1` - a title for the prompt (or -1 for no title).

### Drawing functions

These functions are used to make the above controls, so you can use them if you wish to match this look with custom elements.  There are five states:

*	`enabled` - used by buttons and the active part of sliders
*	`disabled` - used by disabled buttons
*	`inset` - used for meters/displays, and the inactive part of sliders
*	`passive` - used by nav-bar and other non-interactive elements
*	`technical` - used for technical displays (e.g. graphs). Usually dark/black, but may be tinted.

For each of these three states, there are two functions, to apply before and after your control:

*	`control_background_{state}(state)` - fills the viewport with a background pattern for a control, and sets `ui_color()` to something contrasting
*	`control_finish_{state}(state)` - adds gloss/shadows to the element, on top. Strength is in the range (0, 1], with `1` being the default.

The `state` argument is the current mouse hover/click/drag state, which affects the display.  If ommitted (`0` supplied), this is taken from the current mouse state.  However, if you are drawing a complex control where the hover state needs to be consistent (e.g. a slider, where the active part of the slider should respond to mouse hovers), you can use `control_state()` to get an opaque state value to use later.

These functions are designed to work together, but you might use a "finish" on its own to let custom controls fit in (e.g. an oscilloscope drawn on a different background colour, but still finished with `control_finish_enabled()`).

If an element comprises multiple states (e.g. sliders which have an `enabled` element on top of an `inset` groove), it is recommended to draw `inset` first (including the finish), and then either `enabled` or `disabled` on top.

```
// Custom element, with an "enabled" section sitting inside an "inset" groove
ui_push();
	state = control_state();
	control_background_inset();
	control_finish_inset();
	
	ui_push_widthratio(0.5); // Fill half the width
		control_background_enabled(state); // Hover state saved from earlier
		control_finish_enabled(state);
	ui_pop();
ui_pop();
```

#### `control_arrow(direction)`

Draws an arrow aligned towards one edge of the element (it is *not* centred).

Values for `direction` are `0` (left), `1` (top), `2` (right) and `3` (bottom).

## Themes

Currently there are only two themes:

*	`default`
*	`black`

These are identified using the *numerical values* of these string constants, not string comparison!

You can select a theme by using `control_start()` instead of `ui_start()`:

```
@gfx
control_start("main", "black");
```

## Automation, saving state, and "hidden sliders"

If you're not using the built-in sliders, then any variables you control using this UI must be saved using a `@serialize` block.  They will also not be automatable.

```
@serialize
file_var(0, myslidervalue); // Works for both read/write
```

However, you can make a slider hidden from the GUI (by preceding the name with "-").  Like any other sliders, they are automatable and their state is saved automatically.

```
slider1:0<0,1,0>-Slider Name
```

You can then read/control its value from your GUI:

```
slider1 = control_hslider(slider1, 0, 1, 0);
```

## Development

The code is in `pad-synth.txt`.  This project makes use of a [JSFX preprocessor](https://www.npmjs.com/package/jsfx-preprocessor) to generate `pad-synth.jsfx`.

This means that to assemble the final code, you'll need Node.js installed.

```
node build.js
```

To monitor with `nodemon`, use `npm run nodemon` - you can also specify any additional locations to write the result to (e.g. the [JSFX collection](https://github.com/geraintluff/jsfx)):

```
npm run nodemon -- ../jsfx-collection/pad-synth.jsfx
```
