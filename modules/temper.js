// temper.js - module to define the temperament
//
// Copyright (C) 2018-2020 Jean-Francois Moine - GPL3+
//
// This module is loaded when "%%temperament" appears in a ABC source.
//
// Parameters
//	%%temperament <list>
// The <list> must contain 12 integer values that are the detune values in cents
// of the 12 notes of the equal scale.
// Examples:
//
// % pythagore (~500 B.C)
// %%temperament +00 +14 +04 -06 +08 -02 +12 +02 +16 +06 -04 +10
//
// % just intonation
// %%temperament +00 -08 -18 -06 -14 -02 -10 +02 -08 -16 -04 -12
//
// % meantone (Pietro Aaron 1523)
// %%temperament +00 -24 -07 +10 -14 +03 -21 -03 -27 +10 +07 -17
//
// % Andreas Werckmeister III (1681)
// %%temperament +00 -04 +04 +00 -04 +04 +00 +02 -08 +00 +02 -02
//
// % well temperament (F.A. Vallotti 1754)
// %%temperament +00 -06 -04 -02 -08 +02 -08 -02 -04 -06 +00 -10

abc2svg.temper = {

    // get the temperament
    set_fmt: function(of, cmd, param) {
	if (cmd == "temperament") {
	    var	i, tb,
		tb40 = new Float32Array(40),
		ls = new Float32Array(param.split(/ +/))

		for (i = 0; i < ls.length; i++) {
			if (isNaN(ls[i]))
				break
			ls[i] = i + ls[i] / 100	// delta -> MIDI/octave
		}
		switch (i) {
		case 12:
			tb = [	10,11,0,1,2,0,	// C
				0,1,2,3,4,0,	// D
				2,3,4,5,6,	// E
				3,4,5,6,7,0,	// F
				5,6,7,8,9,0,	// G
				7,8,9,10,11,0,	// A
				9,10,11,0,1]	// B
			break
		default:
			this.syntax(1, this.errs.bad_val, "%%temperament")
			return
		}
		for (i = 0; i < 40; i++)
			tb40[i] = ls[tb[i]]
		this.cfmt().temper = tb40
		return
	}
	of(cmd, param)
    },

    set_hooks: function(abc) {
	abc.set_format = abc2svg.temper.set_fmt.bind(abc, abc.set_format)
    }
} // temper


abc2svg.modules.hooks.push(abc2svg.temper.set_hooks);

// the module is loaded
abc2svg.modules.temperament.loaded = true
