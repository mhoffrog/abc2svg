// abc2svg - strtab.js - tablature for string instruments
//
// Copyright (C) 2020 Jean-Francois Moine
// License GPL-3
//
// This module is loaded by %%strtab.
// The command %%strtab changes the display of the voice to a tablature.
// Syntax:
//	%%strtab <string list> [diafret]
// <string list> is the list of the strings as ABC notes
// diafret indicates the instrument has diatonic frets
// The fret may be forced by a decoration format
//	"!" digit "s!"
// where 'digit' is the string range in the string list (last string is '1')
//
// This module accepts Willem Vree's tablature syntax:
//	https://wim.vree.org/svgParse/abc2xml.html#tab

abc2svg.strtab = {

    // draw the tablature
    draw_symbols: function(of, p_v) {
    var	s, m, not, stb, x, y,
	C = abc2svg.C,
	abc = this

	if (!p_v.tab) {
		of(p_v)
		return
	}

	// define the 'bgx' filter if not done yet
	m = abc.cfmt().bgcolor || "white"
	if (abc.bgt != m) {
		if (!abc.bgn)
			abc.bgn = 1
		else
			abc.bgn++
		abc.bgt = m
		abc.defs_add('\
<filter x="-0.1" y="0.2" width="1.2" height=".8" id="bg' + abc.bgn + '">\n\
<feFlood flood-color="' + m + '"/>\n\
<feComposite in="SourceGraphic" operator="over"/>\n\
</filter>')
		abc.add_style('\n.bg' + abc.bgn + '{filter:url(#bg' + abc.bgn + ')}')
	}

	// adjust the symbol before generation
	for (s = p_v.sym; s; s = s.next) {
		switch (s.type) {
		case C.KEY:
		case C.METER:
		case C.REST:
			s.invis = true
			break
		case C.NOTE:
			if (!s.stemless)
				s.ys = -10
			break
		}
	}
	of(p_v)

	abc.glout()			// output the stems

	// draw the note heads
	stb = abc.get_staff_tb()[p_v.st].y
	abc.out_svg('<g class="bn">\n')
	for (s = p_v.sym; s; s = s.next) {
		if (s.type == C.NOTE) {
			for (m = 0; m <= s.nhd; m++) {
				not = s.notes[m]
				x = s.x - 3
				if (not.nb >= 10)
					x -= 3
				y = 3 * (not.pit - 18)
				abc.out_svg('<text class="bg' + abc.bgn +
					'" x="')
				abc.out_sxsy(x, '" y="', stb + y - 2.5)
				abc.out_svg('">' + not.nb + '</text>\n')
			}
		}
	}
	abc.out_svg('</g>\n')
    }, // draw_symbols()

    // set a format parameter
    set_fmt: function(of, cmd, parm) {
	if (cmd == "strtab") {
		if (!parm)
			return
		this.set_v_param("clef", "tab")
		if (parm.indexOf("diafret") >= 0) {
			this.set_v_param("diafret", true)
			parm = parm.replace(/\s*diafret\s*/, "")
		}
		this.set_v_param("strings", parm)
		return
	}
	of(cmd, parm)
    }, // set_fmt()

    // adjust the horizontal offset of the stems
    set_width: function(of, s) {
    var	m, not,
	abc = this,
	C = abc2svg.C,
	o = s.stem < 0 ? 3.5 : -2.5

	of(s)
	if (s.p_v && s.p_v.tab && s.type == C.NOTE && !s.stemless) {
		for (m = 0; m <= s.nhd; m++)
			s.notes[m].shhd = o
	}
    }, // set_width()

    // change the notes when the global generation settings are done
    set_stems: function(of) {
    var	p_v, i, m, nt, n, bi, bn, strss,
	C = abc2svg.C,
	abc = this,
	s = abc.get_tsfirst(),		// first symbol
	strs = [],			// notes per staff - index = staff
	lstr = []			// lowest string per staff - index staff

	// set a string (pitch) and a fret number
	function set_pit(p_v, s, nt, i) {
	    var	st = s.st,
		n = (p_v.diafret ? nt.pit : nt.midi) - p_v.tab[i]

		if (p_v.diafret && nt.acc)
			n += '+'
		nt.acc = 0
		nt.invis = true
		nt.pit = i * 2 + 18
		nt.nb = n
		strss[i] = s.time + s.dur
		if (s.nflags >= -1 && !s.stemless) {
			if (!lstr[st])
				lstr[st] = [ 10 ]
			if (lstr[st][0] > i) {
				lstr[st][0] = i
				lstr[st][1] = s
			}
			s.stemless = true
		}
	} // set_pit()

	// get the string number from the decoration
	// format is either !<n>s! or !<n>!
	function strnum(n) {
		n = n.match(/^([1-9])s?$/)
		return n ? p_v.tab.length - n[1] : -1
	} // strnum()

	// change the notes of the strings when a capo
	p_v = abc.get_voice_tb()
	for (n = 0; n < p_v.length; n++) {
		if (!p_v[n].tab)
			continue
		m = p_v[n].capo
		if (m) {
			for (i = 0; i < p_v[n].tab.length; i++)
				p_v[n].tab[i] += m
		}
	}

	// loop on the notes of the voices with a tablature
	for ( ; s; s = s.ts_next) {
		p_v = s.p_v
		if (!p_v.tab)
			continue
		strss = strs[s.st]
		if (!strss)
			strss = strs[s.st] = []
		switch (s.type) {
		case C.KEY:
		case C.REST:
		case C.TIME:
			s.invis = true
		default:
			continue
		case C.NOTE:
			break
		}

		// handle the fret numbers as chord decoration
		if (!s.nhd && s.a_dd) {
			i = s.a_dd.length
			while (--i >= 0) {
				bi = strnum(s.a_dd[i].name)
				if (bi >= 0) {
					nt = s.notes[0]
					set_pit(p_v, s, nt, bi)
					break
				}
			}
			delete s.a_dd
		}

	ls:	for (m = 0; m <= s.nhd; m++) {
			nt = s.notes[m]
			if (nt.nb != undefined)
				continue
			if (nt.a_dcn) {
				i = nt.a_dcn.length
				while (--i >= 0) {
					bi = strnum(nt.a_dcn[i])
					if (bi >= 0) {
						set_pit(p_v, s, nt, bi)
						delete nt.a_dcn
						continue ls
					}
				}
				delete nt.a_dcn
			}

			// search the best string
			bn = 100
			i = p_v.tab.length
			while (--i >= 0) {
				if (strss[i] && strss[i] > s.time)
					continue
				n = (p_v.diafret ?
					nt.pit : nt.midi) -
						p_v.tab[i]
				if (n >= 0 && n < bn) {
					bi = i
					bn = n
				}
			}
			set_pit(p_v, s, nt, bi)
		}

		// put the stems on the lowest strings
		if (!s.ts_next || s.ts_next.time != s.time) {
			for (i = 0; i < lstr.length; i++) {
				if (lstr[i]) {
					delete lstr[i][1].stemless
					lstr[i] = null
				}
			}
		}
	}
	of()
    }, // set_stems()

    // get the parameters of the current voice
    set_vp: function(of, a) {
    var	i, e, g, tab, strs, ok,
	p_v = this.get_curvoice()

	// convert a list of ABC notes into a list of MIDI pitches
	function abc2tab(p) {
	    var	i, c,
		t = []

		if (p_v.diafret) {
		    for (i = 0; i < p.length; i++) {
			c = p[i]
			c = "CDEFGABcdefgab".indexOf(c)
			if (c < 0)
				return // null
			c += 16
			while (1) {
				if (p[i + 1] == "'") {
					c += 7
					i++
				} else if (p[i + 1] == ",") {
					c -= 7
					i++
				} else {
					break
				}
			}
			t.push(c)
		    }
		} else {
		    for (i = 0; i < p.length; i++) {
			c = p[i]
			c = "CCDDEFFGGAABccddeffggaab".indexOf(c)
			if (c < 0)
				return // null
			c += 60
			while (1) {
				if (p[i + 1] == "'") {
					c += 12
					i++
				} else if (p[i + 1] == ",") {
					c -= 12
					i++
				} else {
					break
				}
			}
			t.push(c)
		    }
		}
		return t
	} // abc2tab

	// convert an array of <note name><octave> into a list of MIDI pitches
	function str2tab(a) {
	    var	str, p, o,
		t = []

		if (p_v.diafret) {
		    while (1) {
			str = a.shift()
			if (!str)
				break
			p = "CDEFGAB".indexOf(str[0])
			o = Number(str[1])
			if (p < 0 || isNaN(o))
				return // null
			t.push(o * 7 + p - 12)	// C4 = 16 (12 = 4 * 7 - 16)
		    }
		} else {
		    while (1) {
			str = a.shift()
			if (!str)
				break
			p = "CCDDEFFGGAAB".indexOf(str[0])
			o = Number(str[1])
			if (p < 0 || isNaN(o))
				return // null
			t.push((o + 1) * 12 + p)	// C4 = 60
		    }
		}
		return t
	} // str2tab()

	for (i = 0; i < a.length; i++) {
		switch (a[i]) {
		case "clef=":
			e = a[i + 1]
			if (e != "tab")
				break
			a.splice(i, 1)
			// fall thru
		case "tab":
			a.splice(i, 1)
			i--
			ok = true
			p_v.pos.stm = abc2svg.C.SL_BELOW
			break
		case "strings=":
			strs = a[++i]
			ok = true
			break
		case "nostems":
			p_v.pos.stm = abc2svg.C.SL_HIDDEN
			break
		case "capo=":
			p_v.capo = Number(a[++i])
			break
		case "diafret=":
			i++
		case "diafret":
			p_v.diafret = true
			break
		}
	}

	// define the elements of the tablature
	if (ok) {
		if (strs) {
			if (strs[1] >= '1' && strs[1] <= '9')
				tab = str2tab(strs.split(','))	// W.V.'s syntax
			else
				tab = abc2tab(strs)		// ABC syntax
			if (!tab) {
				this.syntax(1, "Bad strings in tablature")
				ok = false
			}
		} else if (!p_v.tab) {
			tab = p_v.diafret ?
				[10, 14, 17] :		// dulcimer
				[40, 45, 50, 55, 59, 64] // guitar strings
		}
	}
	if (ok) {
		if (p_v.capo) {
			p_v.tab = []
			for (i = 0; i < tab.length; i++)
				p_v.tab.push(tab[i] + p_v.capo)
		} else {
			p_v.tab = tab
		}

		a.push("clef=")				// set the clef
		g = this.get_glyphs()
		if (tab.length == 3) {
			a.push('"tab3"')
			if (!g.tab3)
// SMuFL: -none-
				g.tab3 = '<text id="tab3"\
 x="-4,-4,-4" y="-4,3,10"\
 style="font:bold 8px sans-serif">TAB</text>'
		} else if (tab.length == 4) {
			a.push('"tab4"')
			if (!g.tab4)
// SMuFL: \ue06e
				g.tab4 = '<text id="tab4"\
 x="-4,-4,-4" y="-8,1,10"\
 style="font:bold 12px sans-serif">TAB</text>'
		} else if (tab.length == 5) {
			a.push('"tab5"')
			if (!g.tab5)
// SMuFL: -none-
				g.tab5 = '<text id="tab5"\
 x="-4,-4,-4" y="-11,-2,7"\
 style="font:bold 12px sans-serif">TAB</text>'
		} else {
			a.push('"tab6"')
			if (!g.tab6)
// SMuFL: \ue06d
				g.tab6 = '<text id="tab6"\
 x="-4,-4,-4" y="-14.5,-4,5.5"\
 style="font:bold 13px sans-serif">TAB</text>'
		}
		a.push("stafflines=")
		a.push("|||||||||".slice(0, tab.length))
		p_v.staffscale = 1.6
//		p_v.scale = .6
//		p_v.straightflags = true
	}
	of(a)
    }, // set_vp()

    set_hooks: function(abc) {
	abc.draw_symbols = abc2svg.strtab.draw_symbols.bind(abc, abc.draw_symbols)
	abc.set_format = abc2svg.strtab.set_fmt.bind(abc, abc.set_format);
	abc.set_stems = abc2svg.strtab.set_stems.bind(abc, abc.set_stems)
	abc.set_width = abc2svg.strtab.set_width.bind(abc, abc.set_width)
	abc.set_vp = abc2svg.strtab.set_vp.bind(abc, abc.set_vp)

	// define specific decorations used to force the string number
    var	decos = abc.get_decos()
	decos["1s"] = "0 nul 0 0 0"
	decos["2s"] = "0 nul 0 0 0"
	decos["3s"] = "0 nul 0 0 0"
	decos["4s"] = "0 nul 0 0 0"
	decos["5s"] = "0 nul 0 0 0"
	decos["6s"] = "0 nul 0 0 0"
	if (!user.nul)
		user.nul = function() {}

	abc.add_style("\n.bn{font:bold 8px sans-serif}")
    } // set_hooks()
} // strtab

abc2svg.modules.hooks.push(abc2svg.strtab.set_hooks)
abc2svg.modules.strtab.loaded = true
