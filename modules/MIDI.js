// MIDI.js - module to handle the %%MIDI parameters
//
// Copyright (C) 2019 Jean-Francois Moine - GPL3+
//
// This module is loaded when "%%MIDI" appears in a ABC source.
//
// Parameters (see abcMIDI for details)
//	%%MIDI channel n
//	%%MIDI program n
//	%%MIDI control k v
//	%%MIDI drummap ABC_note MIDI_pitch

// Using %%MIDI drummap creates a voicemap named "MIDIdrum".
// This name must be used if some print map is required:
//	%%MIDI drummap g 42
//	%%map MIDIdrum g heads=x
// A same effect may be done by
//	%%percmap g 42 x
// but this is not abcMIDI compatible!

abc2svg.MIDI = {

    // parse %%MIDI commands
    do_midi: function(parm) {

    // convert a ABC note to b40 (string)
    function abc_b40(p) {
    var	pit,
	acc = 0,
	i = 0

	switch (p[0]) {
	case '^':
		if (p[++i] == '^') {
			acc = 2
			i++
		} else {
			acc = 1
		}
		break
	case '=':
		i++
		break
	case '_':
		if (p[++i] == '_') {
			acc = -2
			i++
		} else {
			acc = -1
		}
		break
	}
	pit = 'CDEFGABcdefgab'.indexOf(p[i++]) + 16
	if (pit < 16)
		return
	while (p[i] == "'") {
		pit += 7
		i++
	}
	while (p[i] == ",") {
		pit -= 7
		i++
	}
	return abc2svg.pab40(pit, acc).toString()
    } // abc_b40()

    // convert a MIDI pitch to b40
    function mid_b40(p) {
    var	pit = Number(p)
	if (isNaN(pit))
		return
	p = (pit / 12) | 0		// octave
	pit = pit % 12;			// in octave
	return p * 40 + abc2svg.isb40[pit] + 2
    } // mid_b40()

    // do_midi()
    var	n, v, s, maps,
	a = parm.split(/\s+/)

	switch (a[1]) {
	case "channel":				// channel 10 is bank 128
		if (a[2] != "10")
			break			// other channel values are ignored
		abc2svg.MIDI.do_midi.call(this, "MIDI control 0 1")	// MSB bank
		abc2svg.MIDI.do_midi.call(this, "MIDI control 32 0")	// LSB bank
		break
	case "drummap":
//fixme: should have a 'MIDIdrum' per voice?
		n = abc_b40(a[2])
		v = mid_b40(a[3])
		if (!n || !v) {
			this.syntax(1, this.errs.bad_val, "%%MIDI drummap")
			break
		}
		maps = this.get_maps()
		if (!maps.MIDIdrum)
			maps.MIDIdrum = {}
		if (!maps.MIDIdrum[n])
			maps.MIDIdrum[n] = []
		maps.MIDIdrum[n][3] = v
		this.set_v_param("mididrum", "MIDIdrum")
		break
	case "program":
		if (a[3] != undefined)	// the channel is unused
			v = a[3]
		else
			v = a[2];
		v = parseInt(v)
		if (isNaN(v) || v < 0 || v > 127) {
			this.syntax(1, "Bad program in %%MIDI")
			return
		}
		if (this.parse.state == 3) {
			s = this.new_block("midiprog");
			s.play = true
			s.instr = v
		} else {
			this.set_v_param("instr", v)
		}
		break
	case "control":
		n = parseInt(a[2])
		if (isNaN(n) || n < 0 || n > 127) {
			this.syntax(1, "Bad controller number in %%MIDI")
			return
		}
		v = parseInt(a[3])
		if (isNaN(v) || v < 0 || v > 127) {
			this.syntax(1, "Bad controller value in %%MIDI")
			return
		}
		if (this.parse.state == 3) {
			s = this.new_block("midictl");
			s.play = true
			s.ctrl = n;
			s.val = v
		} else {
			this.set_v_param("midictl", a[2] + ' ' + a[3])
		}
		break
	}
    }, // do_midi()

    // set the MIDI parameters in the current voice
    set_midi: function(a) {
    var	i, item,
	curvoice = this.get_curvoice()

	for (i = 0; i < a.length; i++) {
		switch (a[i]) {
		case "instr=":			// %%MIDI program
			curvoice.instr = a[i + 1]
			break
		case "midictl=":		// %%MIDI control
			if (!curvoice.midictl)
				curvoice.midictl = []
			item = a[i + 1].split(' ');
			curvoice.midictl[item[0]] = Number(item[1])
			break
		case "mididrum=":		// %%MIDI drummap note midipitch
			if (!curvoice.map)
				curvoice.map = {}
			curvoice.map = a[i + 1]
			break
		}
	}
    }, // set_midi()

    do_pscom: function(of, text) {
	if (text.slice(0, 5) == "MIDI ")
		abc2svg.MIDI.do_midi.call(this, text)
	else
		of(text)
    },

    set_vp: function(of, a) {
	abc2svg.MIDI.set_midi.call(this, a);
	of(a)
    },

    set_hooks: function(abc) {
	abc.do_pscom = abc2svg.MIDI.do_pscom.bind(abc, abc.do_pscom);
	abc.set_vp = abc2svg.MIDI.set_vp.bind(abc, abc.set_vp)
    }
} // MIDI

abc2svg.modules.hooks.push(abc2svg.MIDI.set_hooks);

// the module is loaded
abc2svg.modules.MIDI.loaded = true
