// sndgen.js - sound generation
//
// Copyright (C) 2019 Jean-Francois Moine
//
// This file is part of abc2svg-core.
//
// abc2svg-core is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// abc2svg-core is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with abc2svg-core.  If not, see <http://www.gnu.org/licenses/>.

// This script generates the play data which are stored in the music symbols:
// - in all symbols
//	s.ptim = play time
// - in BAR
//	rep_p = on a right repeat bar, pointer to the left repeat symbol
//	rep_s = on the first repeat variant, array of pointers to the next symbols,
//						indexed by the repeat number
// - in NOTE and REST
//	s.pdur = play duration
//	s.instr = bank + instrument
// - in the notes[] of NOTE
//	s.notes[i].midi

function ToAudio() {
 return {
   clear: function() {		// useless - for compatibility
   },

   // generate the play data of a tune
   add: function(s,		// starting symbol
		voice_tb) {	// voice table
    var	C = abc2svg.C,
	p_time = 0,		// last playing time
	abc_time = 0,		// last ABC time
	play_fac = C.BLEN / 4 * 120 / 60, // play time factor - default: Q:1/4=120
	i, n, dt, d, v,
	rst = s,		// left repeat (repeat restart)
	rst_fac,		// play factor on repeat restart
	rsk,			// repeat variant (repeat skip)
	instr = []		// [voice] bank + instrument

	// generate the grace notes
	function gen_grace(s) {
	    var	g, i, n, t, d, s2,
		next = s.next

		// before beat
		if (s.sappo) {
			d = C.BLEN / 16
		} else if ((!next || next.type != C.NOTE)
			&& s.prev && s.prev.type == C.NOTE) {
			d = s.prev.dur / 2

		// on beat
		} else {
			d = next.dur / 12
			if (d & (d - 1) == 0)
				d = next.dur / 2	// no dot
			else
				d = next.dur / 3
			next.time += d
			next.dur -= d
		}
//fixme: assume the grace notes have the same duration
		n = 0
		for (g = s.extra; g; g = g.next)
			n++
		d /= n * play_fac
		t = p_time
		for (g = s.extra; g; g = g.next) {
			g.ptim = t
			g.pdur = d
			g.instr = instr[s.v]
			t += d
		}
	} // gen_grace()

	// add() main

	// set the MIDI pitches
	AbcMIDI().add(s, voice_tb)

	// loop on the symbols
	rst = s
	rst_fac = play_fac
	while (s) {
		if (s.noplay) {			// in display macro sequence
			s = s.ts_next
			continue
		}
		if (s.tempo) {				// tempo change
			d = 0
			n = s.tempo_notes.length
			for (i = 0; i < n; i++)
				d += s.tempo_notes[i]
			play_fac = d * s.tempo / 60
		}

		dt = s.time - abc_time
		if (dt > 0) {
			p_time += dt / play_fac
			abc_time = s.time
		}
		s.ptim = p_time
		v = s.v

		if (instr[v] == undefined)
			instr[v] = voice_tb[v].instr || 0

		switch (s.type) {
		case C.BAR:

			// right repeat
			if (s.bar_type[0] == ':') {
				s.rep_p = rst		// :| to |:
				n = s.text		// variants
				while (s.ts_next && s.ts_next.type == C.BAR) {
					s = s.ts_next
					s.ptim = p_time
					if (!n && s.text)
						n = s.text
				}
				if (rsk) {		// if in a variant
					if (!n)
						n = "a"		// last time
					n = n.match(/[1-8]-[2-9]|[1-9,.]|[^\s]+$/g)
					while (1) {
						d = n.shift()
						if (!d)
							break
						if (d[1] == '-')
							for (i = d[0]; i <= d[2]; i++)
								rsk.rep_s[i] = s
						else if (d >= '1' && d <= '9')
							rsk.rep_s[Number(d)] = s
						else
							rsk.rep_s.push(s)
					}
					play_fac = rst_fac
				    break
				}
			}

			// left repeat
			if (s.bar_type.slice(-1) == ':') {
				rst = s
				rst_fac = play_fac

			// 1st time repeat
			} else if (s.text && s.text[0] == '1') {
				rsk = s
				s.rep_s = [null, s]	// repeat skip
			}
			break
		case C.BLOCK:
			switch (s.subtype) {
			case "midictl":
				switch (s.ctrl) {
				case 0:			// MSB bank
					instr[v] = (instr[v] & 0x3fff) |
						(s.val << 14)
					break
				case 32:		// LSB bank
					instr[v] = (instr[v] & 0x1fc07f) |
						(s.val << 7)
					break
//				case 121:		// reset all controllers
//					instr = []
//					break
				}
				break
			case "midiprog":
				instr[v] = (instr[v] & ~0x7f) | s.instr
				break
			}
			break
		case C.GRACE:
			if (s.time == 0		// if before beat at start time
			 && abc_time == 0) {
				dt = 0
				if (s.sappo)
					dt = C.BLEN / 16
				else if (!s.next || s.next.type != C.NOTE)
					dt = d / 2
				abc_time -= dt
			}
			gen_grace(s)
			break
		case C.REST:
		case C.NOTE:
			d = s.dur
			if (s.next && s.next.type == C.GRACE) {
				dt = 0
				if (s.next.sappo)
					dt = C.BLEN / 16
				else if (!s.next.next || s.next.next.type != C.NOTE)
					dt = d / 2
				s.next.time -= dt
				d -= dt
			}
			d /= play_fac
			s.pdur = d
			s.instr = instr[v]
			break
		}
		s = s.ts_next
	} // loop
   } // add()
 } // return
} // ToAudio()

// nodejs
if (typeof module == 'object' && typeof exports == 'object')
	exports.ToAudio = ToAudio
