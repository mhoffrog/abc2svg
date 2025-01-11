//#javascript
// abcweb-1.js file to include in html pages
//
// Copyright (C) 2014-2021 Jean-Francois Moine
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

// This script is used in HTML or XHTML files.
// It replaces the ABC sequences
// - contained in <script> elements with the type "text/vnd.abc", or
// - defined in HTML elements with the class "abc", or
// - starting with "%abc-n" or "X:n" at start of line up to a XML tag
// by music as SVG images.
// The other elements stay in place.
// The script abc2svg-1.js may be loaded before this script.
// It is automatically loaded when not present.
//
// When the file is .html, if the ABC sequence is contained inside
// elements <script type="text/vnd.abc">, there is no constraint
// about the ABC characters. Note that the <script> element is removed.
// With a container of class "abc", the characters '<', '>' and '&' may be
// replaced by their XML counterparts ('&lt;', '&gt;' and '&amp;').
// When the file is .xhtml, if the ABC sequence contains the characters
// '<', '>' or '&', this sequence must be enclosed in a XML comment
// (%<!-- .. %-->) or in a CDATA (%<![CDATA[ .. %]]>).
//
// ABC parameters may be defined in the query string of the URL.

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

    var user
if (typeof abc2svg == "undefined")
    var abc2svg = {}

// function called when abc2svg is fully loaded
function dom_loaded() {
var	abc, new_page, src,
	a_inc = {},
	errtxt = '',
	app = "abcweb",
	playing,
	abcplay,
	playconf = {
		onend: function() {
			playing = false
		}
	},
	page,				// document source
	tune_lst,		// array of [tsfirst, voice_tb, info, cfmt] per tune
	jsdir = document.currentScript ?
		    document.currentScript.src.match(/.*\//) :
		    (function() {
		     var s_a = document.getElementsByTagName('script')
			for (var k = 0; k < s_a.length; k++) {
				if (s_a[k].src.indexOf(app) >= 0)
					return s_a[k].src.match(/.*\//) || ''
			}
			return ""	// ??
	})()

// -- abc2svg init argument
    user = {
	read_file: function(fn) {
		return a_inc[fn]
	}, // read_file()
	errmsg: function(msg, l, c) {	// get the errors
		errtxt += clean_txt(msg) + '\n'
	},
	img_out: function(str) {	// image output
		new_page += str
	}
    }

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
}

	// function called on click on the music
	abc2svg.playseq = function(evt) {
	    var	i, j,
		svg = evt.target,
		e = svg			// keep the clicked element

		// search if click in a SVG image
		while (svg.tagName != 'svg') {
			svg = svg.parentNode
			if (!svg)
				return
		}
		i = svg.getAttribute('class')
		if (!i)
			return
		i = i.match(/tune(\d+)/)
		if (!i)
			return
		i = i[1]		// tune number

		// initialize the play object
		if (!abcplay) {
			if (typeof AbcPlay == "undefined") { // as snd-1.js not loaded,
				abc2svg.playseq = function(){}	// don't come here anymore
				return
			}
			if (abc.cfmt().soundfont)
				playconf.sfu = abc.cfmt().soundfont
			abcplay = AbcPlay(playconf);
		}

		// if first time, get the tunes references
		// and generate the play data of all tunes
		if (!tune_lst) {
			tune_lst = abc.tunes
			for (j = 0; j < tune_lst.length; j++)
				abcplay.add(tune_lst[j][0],
					tune_lst[j][1],
					tune_lst[j][3])
		}

		// check if click on a music symbol
		// (this works when 'follow' is active)
		s = tune_lst[i][0]		// first symbol of the tune
		i = e.getAttribute('class')
		if (i)
			i = i.match(/abcr _(\d+)_/)
		if (playing) {
			abcplay.stop();
			if (!i)
				return
		}
		if (i) {
			i = i[1]		// symbol offset in the source
			while (s && s.istart != i)
				s = s.ts_next
			if (!s) {		// fixme: error ?!
				alert("play bug: no such symbol in the tune")
				return
			}
		}

		playing = true
		abcplay.play(s, null)
	} // playseq()

	// convert HTML to ABC
	function toabc(s) {
		return s.replace(/&gt;/g, '>')
			.replace(/&lt;/g, '<')
			.replace(/&amp;/g, '&')
			.replace(/[ \t]+(%%|.:)/g, '$1')
	} // toabc()

// function to load javascript files
	abc2svg.loadjs = function(fn, relay, onerror) {
		var s = document.createElement('script');
		if (/:\/\//.test(fn))
			s.src = fn		// absolute URL
		else
			s.src = jsdir + fn;
		if (relay)
			s.onload = relay;
		s.onerror = onerror || function() {
			alert('error loading ' + fn)
		}
		document.head.appendChild(s)
	}

function render() {

	// search the ABC tunes,
	// replace them by SVG images with play on click

//search in page
// 1- <script type="text/vnd.abc"> ..ABC.. <script>
// 2- <anytag .. class="abc" .. > ..ABC.. </anytag>
// 3- %abc-n ..ABC.. '<' with skip %%beginxxx .. %%endxxx
// 4- X:n ..ABC.. '<' with skip %%beginxxx .. %%endxxx

    var	i = 0, j, k, res,
	re = /<script type="text\/vnd.abc"|<[^>]* class="abc"|%abc-\d|X:\s*\d/g,
	re_stop = /\n<|\n%.begin[^\s]+/g

	// aweful hack: user.anno_stop must be defined before Abc creation
	// for being set later by follow() !
	if (typeof follow == "function")
		user.anno_stop = function(){};

	abc = new abc2svg.Abc(user)
	new_page = ''

	// initialize the play follow function
	if (typeof follow == "function")
		follow(abc, user, playconf)

	// handle MEI files
	j = page.indexOf("<mei ")
	if (j >= 0) {
		k = page.indexOf("</mei>") + 6
		abc.mei2mus(page.slice(j, k))
		document.body.innerHTML = new_page
		return
	}

	src = '%%beginml\n'
	for (;;) {

		// get the start of a ABC sequence
		res = re.exec(page)
		if (!res) {
			src += page.slice(i).replace(/\n%%/g,"\n%%%%") +
					"\n%%endml\n"
			break
		}
		j = re.lastIndex - res[0].length;

		// (the core removes '%%' at start of line)
		src += page.slice(i, j).replace(/\n%%/g,"\n%%%%")

		switch (res[0][0]) {
		default:
			res = res[0].match(/<([^\s]*)/)[1]	// tag
			if (res == 'script') {		// <script
				j = page.indexOf('>', j) + 2
				i = page.indexOf('</' + res, j)
				src += "%%endml\n" +
					page.slice(j, i) // keep the script content only
				i += 10
			} else {			// < .. class="abc"
				i = page.indexOf('>', j) + 1
				src += page.slice(j, i) + "\n%%endml\n"
				i = page.indexOf('\n', i)
				j = page.indexOf('</' + res, i)
				src += toabc(page.slice(i, j))	// keep the element
				i = j
			}
			break
		case '%':		// %abc
		case 'X':		// X:
			if (j != 0 && page[j - 1] != '\n') {
				src += res[0]		// not at start of line
				i = re.lastIndex
				continue
			}

			// get the end of the ABC sequence
			// including the %%beginxxx/%%endxxx sequences
			re_stop.lastIndex = j
			while (1) {
				res = re_stop.exec(page)
				if (!res || res[0] == "\n<")
					break
				k = page.indexOf(res[0].replace("begin", "end"),
						re_stop.lastIndex)
				if (k < 0)
					break
				re_stop.lastIndex = k
			}
			if (!res || k < 0)
				i = page.length
			else
				i = re_stop.lastIndex - 1
			src += "%%endml\n" + page.slice(j, i)
			break
		}
		if (i < 0)
			break			// problem!
		re.lastIndex = i
		src += '%%beginml\n'
	}

	// use the query string of URL for global parameters
	k = location.search.substr(1).split("&")
	for (i = 0; i < k.length; i++) {
		if (k[i]) {
			j = k[i].split('=')
			if (j[0])
				abc.tosvg(app, "%%" + j[0] + " " +
						decodeURIComponent(j[1]))
		}
	}

	// generate the new source
	try {
		abc.tosvg(app, src)
	} catch (e) {
		alert("abc2svg javascript error: " + e.message +
			"\nStack:\n" + e.stack)
	}
	abc2svg.abc_end()		// close the page if %%pageheight
	if (errtxt) {
		new_page += '<pre class="nop" style="background:#ff8080">' +
				errtxt + "</pre>\n"
		errtxt = ""
	}

	// change the page
	try {
		document.body.innerHTML = new_page
	} catch (e) {
		alert("abc2svg bad generated SVG: " + e.message +
			"\nStack:\n" + e.stack)
	}

	// prepare for play on click
	window.onclick = abc2svg.playseq
} // render()

	// load the %%abc-include files
	function include() {
	    var	i, j, fn, r,
		k = 0

		while (1) {
			i = page.indexOf('%%abc-include ', k)
			if (i < 0) {
				render()
				return
			}
			i += 14
			j = page.indexOf('\n', i)
			fn = page.slice(i, j).trim()
			if (!a_inc[fn])
				break
			k = j
		}

		// %%abc-include found: load the file
		r = new XMLHttpRequest()
		r.open('GET', fn, true)		// (async)
		r.onload = function() {
			if (r.status === 200) {
				a_inc[fn] = r.responseText
				if (abc2svg.modules.load(a_inc[fn], include))
					include()
			} else {
				a_inc[fn] = '%\n'
				alert('Error getting ' + fn + '\n' + r.statusText)
				include()
			}
		}
		r.onerror = function () {
			a_inc[fn] = '%\n'
			alert('Error getting ' + fn + '\n' + r.statusText)
			include()
		}
		r.send()
	} // include()

	// --- dom_loaded() main code ---

	// get the page content
	page = document.body.innerHTML

	// load the abc2svg core if not done by <script>
	if (!abc2svg.Abc) {
		abc2svg.loadjs(page.indexOf("<mei ") >= 0 ?
					"mei2svg-1.js" :
					"abc2svg-1.js",
						dom_loaded)
		return
	}

	// accept page formatting
	abc2svg.abc_end = function() {}

	// load the required modules, then render the music
	if (abc2svg.modules.load(page, include))
		include()
} // dom_loaded()

// wait for the scripts to be loaded
window.addEventListener("load", dom_loaded)
