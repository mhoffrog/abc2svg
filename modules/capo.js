// capo.js - module to add a capo chord line
//
// Copyright (C) 2018-2020 Jean-Francois Moine - GPL3+
//
// This module is loaded when "%%capo" appears in a ABC source.
//
// Parameters
//	%%capo n	'n' is the capo fret number

abc2svg.capo = {

    gch_build: function(of, s) {
    var	t, i, gch, gch2, i2,
	abc = this,
	p_v = abc.get_curvoice(),
	a_gch = s.a_gch

	if (p_v.capo && a_gch) {
		t = p_v.capo
		i = 0

		while (1) {
			gch = a_gch[i++]
			if (!gch)
				return
			if (gch.type == 'g')
				break
		}
		gch2 = Object.create(gch)
		gch2.capo = false	// (would be erased when setting gch)
		gch2.text = abc.gch_tr1(gch2.text, -abc2svg.ifb40[t % 12])
		if (!p_v.capo_first) {		// if new voice
			p_v.capo_first = true
			gch2.text += "  (capo: " + t.toString() + ")"
		}

		gch2.font = abc.get_font(abc.cfmt().capofont ?
						"capo" : "annotation")
		a_gch.splice(i, 0, gch2)

		// set a mark in the first chord symbol for %%diagram
		gch.capo = true
	}
	of(s)
    },

    set_fmt: function(of, cmd, param) {
	if (cmd == "capo") {
		this.set_v_param("capo_", param)
		return
	}
	of(cmd, param)
    },

    // get the parameters of the current voice
    set_vp: function(of, a) {
    var	i, v,
	p_v = this.get_curvoice()

	for (i = 0; i < a.length; i++) {
		if (a[i] == "capo_=") {
			v = Number(a[++i])
			if (isNaN(v) || v <= 0)
				this.syntax(1, "Bad fret number in %%capo")
			else
				p_v.capo = v
			break
		}
	}
	of(a)
    }, // set_vp()

    set_hooks: function(abc) {
	abc.gch_build = abc2svg.capo.gch_build.bind(abc, abc.gch_build);
	abc.set_format = abc2svg.capo.set_fmt.bind(abc, abc.set_format)
	abc.set_vp = abc2svg.capo.set_vp.bind(abc, abc.set_vp)
    }
} // capo

abc2svg.modules.hooks.push(abc2svg.capo.set_hooks);

// the module is loaded
abc2svg.modules.capo.loaded = true
