//#javascript
// abcemb2-1.js file to include in html pages with abc2svg-1.js
//
// Copyright (C) 2018-2019 Jean-Francois Moine
//
// This file is part of abc2svg.
//
// abc2svg is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// abc2svg is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with abc2svg.  If not, see <http://www.gnu.org/licenses/>.

window.onerror = function(msg, url, line) {
	if (typeof msg == 'string')
		alert("window error: " + msg +
			"\nURL: " + url +
			"\nLine: " + line)
	else if (typeof msg == 'object')
		alert("window error: " + msg.type + ' ' + msg.target.src)
	else
		alert("window error: " + msg)
	return false
}

if (typeof abc2svg == "undefined")
    var	abc2svg = {}

// function called when abc2svg is fully loaded
function dom_loaded() {
    var	abc, i, elt,
	errtxt = '',
	elts,				// ABC HTML elements
	abcsrc = "",			// ABC source
	indx = [],			// indexes of the tunes in abcsrc
	select,
	playing,
	abcplay,
	playconf = {
		onend: function() {
			playing = false
		}
	},
	tune_lst,		// array of [tsfirst, voice_tb] per tune
	jsdir = document.currentScript ?
		    document.currentScript.src.match(/.*\//) :
		    (function() {
		     var s_a = document.getElementsByTagName('script')
			for (var k = 0; k < s_a.length; k++) {
				if (s_a[k].src.indexOf('abcweb2-') >= 0)
					return s_a[k].src.match(/.*\//) || ''
			}
			return ""	// ??
		})(),

	// abc2svg init argument
	user = {
		errmsg: function(msg, l, c) {	// get the errors
			errtxt += clean_txt(msg) + '\n'
		},
		img_out: function(str) {	// image output
			if (str.slice(0, 4) == "<svg")
				new_page += '<svg class="abc' +
					abc.tunes.length + '"' +
					str.slice(4)
			else
				new_page += str
		},
		page_format: true	// define the non-page-breakable blocks
	} // user

	// replace <>& by XML character references
	function clean_txt(txt) {
		return txt.replace(/<|>|&.*?;|&/g, function(c) {
			switch (c) {
			case '<': return "&lt;"
			case '>': return "&gt;"
			case '&': return "&amp;"
			}
			return c
		})
	} // clean_txt()

	// function called on click in the screen
	abc2svg.playseq = function(evt) {
	    var	outputs, e, i,
		tunes = abc.tunes,
		svg = evt.target

		// search if click in a SVG image
		while (svg.tagName != 'svg') {
			svg = svg.parentNode
			if (!svg)
				return
		}
		i = svg.getAttribute('class').match(/abc(\d)/)
		if (!i)
			return
		i = i[1] - 1			// tune number

		// initialize the play object
		if (!abcplay) {

			// if play-1.js is not loaded, don't come here anymore
			if (typeof AbcPlay == "undefined") {
				abc2svg.playseq = function(){}
				return
			}
			abcplay = AbcPlay(playconf)
		}
		if (playing) {
			abcplay.stop()
			return
		}

		// if first time, get the tunes references
		// and generate the play data of all tunes
		if (tunes.length) {
			tune_lst = tunes.slice(0)	// (array copy)
			while (1) {
				e = tunes.shift()
				if (!e)
					break
				abcplay.add(e[0], e[1])
			}
		}

		playing = true
		abcplay.play(tune_lst[i][0], null)
	} // playseq()

	function render() {
	    var	i, sel

		// aweful hack: user.anno_stop must be defined before Abc creation
		// for being set later by follow() !
		if (typeof follow == "function")
			user.anno_stop = function(){}

		abc = new abc2svg.Abc(user)

		// initialize the play follow function
		if (typeof follow == "function")
			follow(abc, user, playconf)

		// do the selection
		sel = window.location.hash.slice(1)
		if (sel) {
			select = '%%select ' + decodeURIComponent(sel)
			abc.tosvg("abcemb2", select)
		}

		// generate and replace
		for (i = 0; i < elts.length; i++) {
			new_page = ""

			try {
				abc.tosvg('abcemb2', abcsrc, indx[i], indx[i + 1])
			} catch (e) {
				alert("abc2svg javascript error: " + e.message +
					"\nStack:\n" + e.stack)
			}
			if (errtxt) {
				new_page += '<pre style="background:#ff8080">' +
						errtxt + "</pre>\n"
				errtxt = ""
			}
			try {
				elts[i].innerHTML = new_page
			} catch (e) {
				alert("abc2svg bad generated SVG: " + e.message +
					"\nStack:\n" + e.stack)
			}
		}
		abc2svg.abc_end()		// close the page if %%pageheight
	} // render()

	// convert HTML to ABC
	function toabc(s) {
		return s.replace(/&gt;/g, '>')
			.replace(/&lt;/g, '<')
			.replace(/&amp;/g, '&')
			.replace(/[ \t]+(%%)/g, '$1')
			.replace(/[ \t]+(.:)/g, '$1')
	} // toabc()

	// function to load javascript files
	abc2svg.loadjs = function(fn, relay, onerror) {
	    var	s = document.createElement('script')
		if (/:\/\//.test(fn))
			s.src = fn		// absolute URL
		else
			s.src = jsdir + fn
		s.type = 'text/javascript'
		if (relay)
			s.onload = relay
		s.onerror = onerror || function() {
			alert('error loading ' + fn)
		}
		document.head.appendChild(s)
	}

	// accept page formatting
	abc2svg.abc_end = function() {}

	// prepare for play on click
	window.onclick = abc2svg.playseq

	// extract the ABC source
	elts = document.getElementsByClassName('abc')
	for (i = 0; i < elts.length; i++) {
		elt = elts[i]
		indx[i] = abcsrc.length
		abcsrc += toabc(elt.innerHTML) + '\n'
	}
	indx[i] = abcsrc.length

	// load the required modules
	if (abc2svg.modules.load(abcsrc, render))
		render()
} // dom_loaded()

// wait for the page to be loaded
window.addEventListener("load", dom_loaded)
