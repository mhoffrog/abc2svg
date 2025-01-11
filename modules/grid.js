// grid.js - module to insert a chord grid before or after a tune
//
// Copyright (C) 2018-2020 Jean-Francois Moine - GPL3+
//
// This module is loaded when "%%grid" appears in a ABC source.
//
// Parameters
//	%%grid <n> [include=<list>] [nomusic] [norepeat] [repbrk]
//		<n> = number of columns (1: auto)
//			> 0: above the tune, < 0: under the tune
//		<list> = comma separated list of (continuous) measure numbers
//		'nomusic' displays only the grid
//		'norepeat' omits the ':' indications
//		'repbrk' starts a new grid line on start/stop repeat
//	%%gridfont font_name size (default: 'serif 16')

abc2svg.grid = {
    pl: '<path class="stroke" stroke-width="1" d="M',

// generate the grid
    block_gen: function(of, s) {
	if (s.subtype != "grid") {
		of(s)
		return
	}

    var	abc = this,
	img, cls,
	cfmt = abc.cfmt(),
	grid = cfmt.grid

// generate the grid
function build_grid(chords, bars, font, wmx) {
    var	i, k, l, nr, bar, w, hr, x0, x, y, yl,
	lc = '',
	cells = [],
	nc = grid.n

	// set some chord(s) in each cell
	function set_chords() {
	    var	i, ch,
		pch = '-'

		for (i = 0; i < chords.length; i++) {
			ch = chords[i]
			if (!ch[0])
				ch[0] = pch
			if (ch.length == 0)
				continue
			if (ch.length == 1) {
				pch = ch[0]
				continue
			}
			if (ch.length == 2) {
				ch[2] = ch[1];
				ch[1] = null;
				pch = ch[2]
				continue
			}
			if (ch.length == 3) {
				pch = ch[2]
				continue
			}
			if (!ch[2])
				ch[2] = ch[1] || ch[0];
			pch = ch[3]
		}
	} // set_chords()

	function build_cell(cell, x, y, yl, hr) {
		if (cell.length > 1) {
			abc.out_svg(abc2svg.grid.pl)		// / line
			abc.out_sxsy(x - wmx / 2, ' ', yl)
			abc.out_svg('l' +
				wmx.toFixed(1) + ' -' + hr.toFixed(1) +
				'"/>\n')
			if (cell[1]) {
			    abc.out_svg(abc2svg.grid.pl)	// \ left line
			    abc.out_sxsy(x - wmx / 2, ' ', yl + hr)
			    abc.out_svg('l' +
				(wmx / 2).toFixed(1) + ' ' + (hr / 2).toFixed(1) +
				'"/>\n')
			    abc.set_font('gs')			// small font
			    abc.xy_str(x - wmx / 3, y, cell[0])
			    abc.xy_str(x, y + hr / 3, cell[1])
			} else {
			    abc.set_font('gs')
			    abc.xy_str(x - wmx * .2, y + hr / 4, cell[0])
			}
			if (cell.length >= 3) {
			  if (cell[3]) {
			    abc.out_svg(abc2svg.grid.pl)	// \ right line
			    abc.out_sxsy(x, ' ', yl + hr / 2)
			    abc.out_svg('l' +
				(wmx / 2).toFixed(1) + ' ' + (hr / 2).toFixed(1) +
				'"/>\n')
			    abc.set_font('gs')
			    abc.xy_str(x, y - hr / 3, cell[2])
			    abc.xy_str(x + wmx / 3, y, cell[3])
			  } else {
			    abc.set_font('gs')
			    abc.xy_str(x + wmx * .2, y - hr / 4, cell[2])
			  }
			}
		} else {
			abc.set_font('grid')
			abc.xy_str(x, y, cell[0])
		}
	} // build_cell()

	// ------- build_grid() -------

	// set some chords in each cell
	set_chords()

	// build the content of the cells
	if (!grid.ls) {
		cells = chords
	} else {				// with list of mesure numbers
		bar = bars;
		bars = []
		for (i = 0; i < grid.ls.length; i++) {
			l = grid.ls[i]
			if (l.indexOf('-') < 0)
				l = [l, l]
			else
				l = l.split('-')
			for (k = l[0] - 1; k < l[1]; k++) {
				if (!chords[k])		// error
					break
				cells.push(chords[k]);
				bars.push(bar[k])
			}
		}
	}

	// get the number of columns
	if (nc < 0)
		nc = -nc
	if (nc < 3)				// auto
		nc = cells.length % 6 == 0 ? 6 : 8
	if (nc > cells.length)
		nc = cells.length;

	hr = font.size * 2
	if (wmx < hr * 1.5)
		wmx = hr * 1.5				// cell width

	x0 = img.width - img.lm - img.rm		// staff width
	w = wmx * nc
	if (w > x0) {
		nc /= 2;
		w /= 2
	}

	// generate the cells
	yl = -1
	y = -1 + font.size * .6
	nr = 0
	x0 = (x0 / cfmt.scale - w) / 2
	for (i = 0; i < cells.length; i++) {
		if (i == 0
		 || (grid.repbrk
		  && (bars[i].slice(-1) == ':' || bars[i][0] == ':'))
		 || k >= nc) {
			y -= hr			// new row
			yl -= hr
			x = x0 + wmx / 2
			k = 0
			nr++
		}
		k++
		build_cell(cells[i], x, y, yl, hr)
		x += wmx
	}

	// draw the lines
	abc.out_svg('<path class="stroke" stroke-width="1" d="\n')
	y = -1
	for (i = 0; i <= nr; i++) {
		abc.out_svg('M')
		abc.out_sxsy(x0, ' ', y)
		abc.out_svg('h' + w.toFixed(1)+ '\n')
		y -= hr
	}
	x = x0
	for (i = 0; i <= nc; i++) {
		abc.out_svg('M')
		abc.out_sxsy(x, ' ', -1)
		abc.out_svg('v' + (hr * nr).toFixed(1) + '\n')
		x += wmx
	}
	abc.out_svg('"/>\n')

	// show the repeat signs
	y = -1 + font.size * .7
	x = x0
	for (i = 0; i < bars.length; i++) {
		bar = bars[i]
		if (bar[0] == ':') {
			abc.out_svg('<text class="' + cls + '" x="')
			abc.out_sxsy(x - 5, '" y="', y)
			abc.out_svg('" style="font-weight:bold;font-size:' +
				(font.size * 1.5).toFixed(1) + 'px">:</text>\n')
		}
		if (i == 0
		 || (grid.repbrk
		  && (bars[i].slice(-1) == ':' || bars[i][0] == ':'))
		 || k >= nc) {
			y -= hr;			// new row
			x = x0
			k = 0
		}
		k++
		if (bar.slice(-1) == ':') {
			abc.out_svg('<text class="' + cls + '" x="')
			abc.out_sxsy(x + 5, '" y="', y)
			abc.out_svg('" style="font-weight:bold;font-size:' +
				(font.size * 1.5).toFixed(1) + 'px">:</text>\n')
		}
		x += wmx
	}
	abc.vskip(hr * nr + 6)
} // build_grid()

	// ----- block_gen() -----
    var	p_voice, n, font, f2

	img = abc.get_img()

	// set the text style
	if (!cfmt.gridfont)
		abc.param_set_font("gridfont", "serif 16")
	font = abc.get_font('grid')
	if (font.class)
		font.class += ' mid'
	else
		font.class = 'mid'
	cls = abc.font_class(font)

	// define a smaller font
	abc.param_set_font("gsfont",
		font.name + ' ' + (font.size * .7).toFixed(1))
	f2 = cfmt.gsfont
	if (font.weight)
		f2.weight = font.weight
	if (font.style)
		f2.style = font.style
	f2.class = font.class
	abc.add_style("\n.mid {text-anchor:middle}")

	// create the grid
	abc.blk_flush()
	build_grid(s.chords, s.bars, font, s.wmx)
	abc.blk_flush()
    }, // block_gen()

    output_music: function(of) {
    var	C = abc2svg.C,
	abc = this,
	tsfirst = abc.get_tsfirst(),
	voice_tb = abc.get_voice_tb(),
	grid = abc.cfmt().grid

	function get_beat(s) {
	    var	beat = C.BLEN / 4

		if (!s.a_meter[0] || s.a_meter[0].top[0] == 'C'
		 || !s.a_meter[0].bot)
			return beat
		beat = C.BLEN / s.a_meter[0].bot[0] |0
		if (s.a_meter[0].bot[0] == 8
		 && s.a_meter[0].top[0] % 3 == 0)
			beat = C.BLEN / 8 * 3
		return beat
	} // get_beat()

	// build the arrays of chords and bars
	function build_chords(sb) {		// block 'grid'
	    var	s, i, w, bt, rep,
		bars = [],
		chords = [],
		chord = [],
		beat = get_beat(voice_tb[0].meter),
		wm = voice_tb[0].meter.wmeasure,
		cur_beat = 0,
		beat_i = 0,
		wmx = 0

		// scan the first voice of the tune
		bars.push('|')
		for (s = tsfirst; s; s = s.ts_next) {
			while (s.time > cur_beat) {
				if (beat_i < 3)	// only 2, 3 or 4 beats / measure...
					beat_i++
				cur_beat += beat
			}
			switch (s.type) {
			case C.NOTE:
			case C.REST:
				if (!s.a_gch)
					break

				// search a chord symbol
				for (i = 0; i < s.a_gch.length; i++) {
					if (s.a_gch[i].type == 'g') {
						if (!chord[beat_i]) {
							chord[beat_i] = s.a_gch[i].text
							abc.set_font(s.a_gch[i].font)
							w = abc.strwh(chord[beat_i])[0]
							if (w > wmx)
								wmx = w
						}
						break
					}
				}
				break
			case C.BAR:
				bt = grid.norep ? '|' : s.bar_type
				if (s.time < wm) {		// if anacrusis
					if (chord.length) {
						chords.push(chord)
						bars.push(bt)
					} else {
						bars[0] = bt
					}
				} else {
					if (!s.bar_num)		// if not normal measure bar
						break
					chords.push(chord)
					bars.push(bt)
				}
				chord = []
				cur_beat = s.time	// synchronize in case of error
				beat_i = 0
				if (bt.indexOf(':') >= 0)
					rep = true	// some repeat
				while (s.ts_next && s.ts_next.type == C.BAR)
					s = s.ts_next
				break
			case C.METER:
				beat = get_beat(s)
				wm = s.wmeasure
				break
			}
		}

		if (chord.length) {
			bars.push('')
			chords.push(chord)
		}
		if (!chords.length)
			return			// no chord in this tune

		wmx += abc.strwh(rep ? '    ' : '  ')[0]

		sb.chords = chords
		sb.bars = bars
		sb.wmx = wmx
	} // build_chords

	// -------- output_music --------

	// create a specific block
	if (grid) {
	    var	C = abc2svg.C,
		tsfirst = this.get_tsfirst(),
		voice_tb = this.get_voice_tb(),
		p_v = voice_tb[this.get_top_v()],
		s = {
			type: C.BLOCK,
			subtype: 'grid',
			dur: 0,
			time: 0,
			p_v: p_v,
			v: p_v.v,
			st: p_v.st
		}

		build_chords(s)			// build the array of the chords

		// and insert it in the tune
		if (!s.chords) {		// if no chord
			;
		} else if (grid.nomusic) {	// if just the grid
			this.set_tsfirst(s)
		} else if (grid.n < 0) {	// below
			for (var s2 = tsfirst; s2.ts_next; s2 = s2.ts_next)
				;
			s.time = s2.time
			s.prev = p_v.last_sym.prev // before the last symbol
			s.prev.next = s
			s.next = p_v.last_sym
			p_v.last_sym.prev = s

			s.ts_prev = s2.ts_prev
			s.ts_prev.ts_next = s
			s.ts_next = s2
			s2.ts_prev = s
			if (s2.seqst) {
				s.seqst = true
				s2.seqst = false
			}
		} else {			// above
			s.next = p_v.sym
			s.ts_next = tsfirst
			tsfirst.ts_prev = s
			this.set_tsfirst(s)
			p_v.sym.prev = s
			p_v.sym = s
		}
	}
	of()
    }, // output_music()

    set_fmt: function(of, cmd, parm) {
	if (cmd == "grid") {
		if (!parm)
			parm = "1";
		parm = parm.split(/\s+/)
		var grid = {n: Number(parm.shift())}
		if (isNaN(grid.n)) {
			if (parm.length) {
				this.syntax(1, this.errs.bad_val, "%%grid")
				return
			}
			grid.n = 1
		}
		while (parm.length) {
			var item = parm.shift()
			if (item == "norepeat")
				grid.norep = true
			else if (item == "nomusic")
				grid.nomusic = true
			else if (item == "repbrk")
				grid.repbrk = true
			else if (item.slice(0, 8) == "include=")
				grid.ls = item.slice(8).split(',')
		}
		this.cfmt().grid = grid
		return
	}
	of(cmd, parm)
    },

    set_hooks: function(abc) {
	abc.block_gen = abc2svg.grid.block_gen.bind(abc, abc.block_gen)
	abc.output_music = abc2svg.grid.output_music.bind(abc, abc.output_music);
	abc.set_format = abc2svg.grid.set_fmt.bind(abc, abc.set_format)
    }
} // grid

abc2svg.modules.hooks.push(abc2svg.grid.set_hooks);

// the module is loaded
abc2svg.modules.grid.loaded = true
