// chord.js - generation of accompaniment
//
// Copyright (C) 2020-2024 Jean-Francois Moine and Seymour Shlien
//
// This file is part of abc2svg.
//
// abc2svg is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// abc2svg is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with abc2svg.  If not, see <http://www.gnu.org/licenses/>.

// -- chord table --
// from https://en.wikipedia.org/wiki/Chord_(music)
// index = chord symbol type
// value: array of MIDI pitch / root
//	index = inversion
abc2svg.chnm = {
	'': [0, 4, 7],
	'6': [0, 4, 7, 9],
	'7': [0, 4, 7, 10],
	M7: [0, 4, 7, 11],
	aug: [0, 4, 8],
	aug7: [0, 4, 8, 10],
	m: [0, 3, 7],
	m6: [0, 3, 7, 9],
	m7: [0, 3, 7, 10],
	mM7: [0, 3, 7, 11],
	dim: [0, 3, 6],
	dim7: [0, 3, 6, 9],
	m7b5: [0, 3, 6, 10],
	'9': [0, 4, 7, 10, 14],
//	m9:
//	maj9:
//	M9:
	'11': [0, 4, 7, 10, 14, 17],
	sus4: [0, 5, 7]
//	sus9:
//	'7sus4':
//	'7sus9':
//	'5':
}

abc2svg.letmid = {			// letter -> MIDI pitch
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11
} // letmid

abc2svg.chord = function(first,		// first symbol in time
			 voice_tb,	// table of the voices
			 cfmt) {	// tune parameters
    var	chnm, i, k, vch, s, gchon, s_ch, rhy, ti, dt,
	md = first.p_v.meter.wmeasure,	// measure duration
	nextim = 0,
	C = abc2svg.C,
	trans = 48 + (cfmt.chord.trans ? cfmt.chord.trans * 12 : 0)

	// create a chord according to the bass note
	function chcr(b, ch) {
	    var	t,
		r = ch.slice(),
		i = r.length

		if (b) {
			while (--i > 0) {
				if (r[i] == b)		// search the bass in the chord
					break
			}
			if (i > 0)
				r[0] = b, r[i] = 0
			else
				r.unshift(b)
		}
		r[0] -= 12			// bass one octave lower
		return r
	} // chcr()

	// return a new chord rhythm from a meter (M:)
	function meterhy(s) {
	    var	r,
		t = s.a_meter[0].top,
		b = s.a_meter[0].bot

		switch (b) {
		case '2':
			b = 4
			t *= 2
			// fall thru
		case undefined:
			if (t[0] == 'C')
				t = 4, b = 4
			// fall thru
		case '4':
			if (t == '3')
				return "fzczcz"
			return "fzczfzczfzcz".slice(0, t * 2)
		case '8':
			return "fzcfzcfzcfzc".slice(0, t)
		}
		return 'z'			// no chord
	} // meterhy()

	// build a chord rhythm
	function bld_rhy(p) {
	    var	i, c,
		j = 0

		rhy = p[0]
		for (i = 1; i < p.length; i++) {
			c = p[i]
			if (c >= '1' && c <= '9') {
				while (--c > 0)
					rhy += '+'	// continue playing
				continue
			}
			rhy += c
		}

		dt = md / rhy.length		// delta time
	} // bld_rhy()

	// generate a chord
	function gench(sb, i) {
	    var	r, ch, b, m, n, nt,
		a = sb.a_gch[i].otext

		if (a.slice(-1) == ')')			// if alternate chord
			a = a.replace(/\(.*/, '')	// remove it
		a = a.replace(/\(|\)|\[|\]/g,'')	// remove ()[]
		a = a.match(/([A-G])([#♯b♭]?)([^/]*)\/?(.*)/)
			// a[1] = note, a[2] = acc, a[3] = type, a[4] = bass
		if (!a)
			return

		r = abc2svg.letmid[a[1]]		// root
		if (r == undefined)			// "N" or no chord
			return

			switch (a[2]) {
			case "#":
			case "♯": r++; break
			case "b":
			case "♭": r--; break
			}
			if (!a[3]) {
				ch = chnm[""]
			} else {
				ch = abc2svg.ch_alias[a[3]]
				if (ch == undefined)
					ch = a[3]
				ch = chnm[ch]
				if (!ch)
					ch = a[3][0] == 'm' ? chnm.m : chnm[""]
			}
			if (a[4]) {			// bass
				b = a[4][0].toUpperCase()
				b = abc2svg.letmid[b]
				if (b != undefined) {
					switch (a[4][1]) {
					case "#":
					case "♯": b++; if (b >= 12) b = 0; break
					case "b":
					case "♭": b--;  if (b < 0) b = 11; break
					}
					b = b - r
					if (b < 0)
						b += 12
				}
			}
		ch = chcr(b, ch)

		// generate the notes of the chord
		n = ch.length
		r += trans
		if (sb.p_v.tr_snd)
			r += sb.p_v.tr_snd
		for (m = 0; m < n; m++) {
			nt = s_ch.notes[m]
			if (!nt)
				s_ch.notes[m] = nt = []
			nt.midi = r + ch[m]
		}
		s_ch.nhd = n - 1
	} // gench()

	// stop the previous chord by setting its duration
	function set_dur(s2, tim) {			// previous chord
		if (s2.dur
		 || tim == s2.time
		 || s2.nhd == undefined)	// no chord yet
			return
		s2.dur = tim - s2.time
		for (var m = 0; m <= s2.nhd; m++)
			s2.notes[m].dur = s2.dur
	} // set_dur()

	// insert a chord in the chord voice
	function insch(tim) {
		if (s_ch.nhd == undefined)
			return			// no defined chord yet
	    var	s, m,
		s2 = vch.last_sym,
		i = rhy[ti++]

		switch (i) {
		case '+':			// same chord
			if (rhy != '+')
				return
			i = 'b'			// no rhythm
			ti = 0
			break
		case undefined:
		case 'z':
			set_dur(s2, tim)	// stop the previous chord
			return
		}

		s = {
			v: vch.v,
			p_v: vch,
			type: C.NOTE,
			notes: []
		}
		s.nhd = s_ch.nhd
//		s.dur = s_ch.dur
		for (m = 0; m <= s.nhd; m++)
			s.notes[m] = {
//				dur: s_ch.notes[m].dur,
				midi: s_ch.notes[m].midi
			}
		s.time = tim
		switch (i) {
		case 'c':
			s.notes.shift()		// remove the root note
			s.nhd--
			break
		default:
			i = "GHIJKghijk".indexOf(rhy[ti])
			if (i < 0			// bad character
			 || i >= s.nhd)			// out of chord
				return
			s.notes[0] = s.notes[i % 5]
			if (i >= 5)
				s.notes[0].midi += 12	// upper octave
			// fall thru
		case 'f':
			s.nhd = 0		// keep the chord root
//			break
		case 'b':
			break
		}
		s.prev = s2			// previous chord
		s2.next = s
		set_dur(s2, tim)		// stop the last chord
		
		vch.last_sym = s
		while (s2.time < tim
		    && s2.ts_next)
			s2 = s2.ts_next
		s.ts_prev = s2.ts_prev
		s.ts_prev.ts_next = s
		s.ts_next = s2
		s2.ts_prev = s
	} // insch()

	// -- chord() --

	// set the chordnames defined by %%MIDI chordname
	chnm = abc2svg.chnm
	if (cfmt.chord.names) {
		for (k in cfmt.chord.names) {
			chnm[k] = []
			for (i = 0; i < cfmt.chord.names[k].length; i++)
				chnm[k].push(+cfmt.chord.names[k][i])
		}
	}

	// define the MIDI channel
	k = 0
	for (i = 0; i < voice_tb.length; i++) {
		if (k < voice_tb[i].chn)
			k = voice_tb[i].chn
	}
	if (k == 9)
		k++			// skip the channel 10

	// create the chord voice
	vch = {
		v: voice_tb.length,
		id: "_chord",
		time: 0,
		sym: {
			type: C.BLOCK,
			subtype: "midiprog",
			chn: k + 1,
			instr: cfmt.chord.prog || 0,
			time: 0,
			dur: 0
		},
		vol: cfmt.chord.vol || .6	// (external default 76.2)
	}
	vch.sym.p_v = vch
	vch.sym.v = vch.v
	vch.last_sym = vch.sym
	voice_tb.push(vch)

	s = first
	bld_rhy(cfmt.chord.rhy			// chord rhythm
		|| meterhy(s.p_v.meter))

	// insert the MIDI program of the chord voice after the tempo
	while (s.type != C.TEMPO && !s.dur)
		s = s.ts_next
	vch.sym.ts_prev = s
	vch.sym.ts_next = s.ts_next
	s.ts_next.ts_prev = vch.sym
	s.ts_next = vch.sym

	s_ch = {				// chord template
//		v: vch.v,
//		p_v: vch,
//		type: C.NOTE,
		notes: []
	}

	// loop on the symbols and add the accompaniment chords
	gchon = cfmt.chord.gchon
	ti = 0					// time index in rhy
	s = first
	while (1) {
		if (gchon && rhy != '+') {
			while (s.time > nextim) {
				insch(nextim)	// generate the rhythm
				nextim += dt
			}
		}
		if (s.a_gch) {
			for (i = 0; i < s.a_gch.length; i++) {
				if (s.a_gch[i].type != 'g')
					continue
				gench(s, i)
				if (rhy == '+')
					insch(s.time)	// no rhythm, start now
				break
			}
		}
		if (!s.dur) {
			if (s.bar_num) {		// if measure bar
				ti = 0			// reset the time index
			} else if (s.wmeasure) {	// if meter
				md = s.wmeasure
				if (rhy != '+')
					bld_rhy(meterhy(s))
			} else if (s.subtype == "midigch") {
				if (s.on != undefined)
					gchon = s.on
				else
					bld_rhy(s.rhy)	// new rhythm
			}
		}
		if (!s.ts_next)
			break
		s = s.ts_next
	}
	if (gchon)
		set_dur(vch.last_sym, s.time)
} // chord()
