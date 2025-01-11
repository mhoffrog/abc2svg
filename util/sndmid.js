// sndmid.js - audio output using HTML5 MIDI
//
// Copyright (C) 2019 Jean-Francois Moine
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

// Midi5 creation

// @conf: configuration object - all items are optional:
//	onend: callback function called at end of playing
//		Argument:
//			repv: last repeat variant number
//	onnote: callback function called on note start/stop playing
//		Arguments:
//			i: start index of the note in the ABC source
//			on: true on note start, false on note stop

//  When playing, the following items must/may be set:
//	speed: (mandatory) must be set to 1
//	new_speed: (optional) new speed value

// Midi5 methods

// get_outputs() - get the output ports
//
// set_output() - set the output port
//
// play() - start playing
// @start -
// @stop: start and stop music symbols
// @level: repeat variant (optional, default = 0)
//
// stop() - stop playing

function Midi5(i_conf) {
    var	C = abc2svg.C,
	conf = i_conf,		// configuration
	onend = function() {},
	onnote = function() {},
	rf,			// get_outputs result function

// MIDI variables
	op,			// output port
	v_i = [],		// voice (channel) to instrument

	s_cur,			// current music symbol
	s_end,			// last music symbol / null
	stop,			// stop playing
	repn,			// don't repeat when true
	repv = 0,		// repeat variant number
	stime,			// start playing time in ms
	timouts = []		// note start events

	// create a note
	// @s = symbol
	// @k = MIDI key + detune
	// @t = audio start time (ms)
	// @d = duration adjusted for speed (ms)
	function note_run(s, k, t, d) {
	    var	j,
		a = (k * 100) % 100,	// detune in cents
		i = s.instr,
//fixme: problem when more than 16 voices
		c = s.v & 0x0f		// channel

		k |= 0			// remove the detune value

		if ((s.instr & ~0x7f) == 16384)	// if bank 128 (percussion)
//fixme: may conflict with the voice 9
			c = 9			// force the channel 10
		if (i != v_i[c]) {		// if program change

			// at channel start, reset and initialize the controllers
			if (v_i[c] == undefined) {
//fixme: does not work with fluidsynth
				op.send(new Uint8Array([0xb0 + c, 121, 0]))
				if (s.p_v.midictl) {
				    for (j in s.p_v.midictl)
					op.send(new Uint8Array([0xb0 + c,
								j,
								s.p_v.midictl[j]]))
				}
			}

			v_i[c] = i
			op.send(new Uint8Array([0xc0 + c, i & 0x7f]))	// program
		}
		if (a && Midi5.ma.sysexEnabled) {	// if microtone
// fixme: should cache the current microtone values
			op.send(new Uint8Array([
				0xf0, 0x7f,	// realtime SysEx
				0x7f,		// all devices
				0x08,		// MIDI tuning standard
				0x02,		// note change
				i & 0x7f,		// tuning prog number
				0x01,		// number of notes
					k,		// key
					k,		// note
					a / .78125,	// MSB fract
					0,		// LSB fract
				0xf7		// SysEx end
				]), t)
		}
		op.send(new Uint8Array([0x90 + c, k, 127]), t)		// note on
		op.send(new Uint8Array([0x80 + c, k, 0]), t + d - 20)	// note off
	} // note_run()

	// handle a tie
	function do_tie(s, b40, d) {
	    var	i, note,
		v = s.v,
		end_time = s.time + s.dur

		// search the end of the tie
		while (1) {
			s = s.ts_next
			if (!s)
				return d
			switch (s.type) {
			case C.BAR:
				if (s.rep_p) {
					if (!repn) {
						s = s.rep_p
						end_time = s.time
					}
				}
				if (s.rep_s) {
					if (!s.rep_s[repv + 1])
						return d
					s = s.rep_s[repv + 1]
					end_time = s.time
				}
				while (s.ts_next && s.ts_next.type == C.BAR)
					s = s.ts_next
			}
			if (s.time > end_time)
				return d
			if (s.type == C.NOTE && s.v == v)
				break
		}
		i = s.notes.length
		while (--i >= 0) {
			note = s.notes[i]
			if (note.b40 == b40) {
				note.ti2 = true		// the sound is generated
				d += s.pdur / conf.speed * 1000
				return note.tie_ty ? do_tie(s, b40, d) : d
			}
		}

		return d
	} // do_tie()

	// generate 2 seconds of music
	function play_next() {
	    var	d, i, st, m, note, g, s2,
		s = s_cur,
		t = stime + s.ptim / conf.speed * 1000,	// start time
		maxt = t + 2000			// max time = now + 2 seconds

		if (stop) {
			onend(repv)
			return
		}

		// if speed change, shift the start time
		if (conf.new_speed) {
			stime = window-performance.now() -
					(window.performance.now() - stime) *
						conf.speed / conf.new_speed
			conf.speed = conf.new_speed
			conf.new_speed = 0
			t = stime + s.ptim / conf.speed * 1000
		}

		timouts = []
		while (1) {
			switch (s.type) {
			case C.BAR:
				if (s.bar_type.slice(-1) == ':') // left repeat
					repv = 0
				if (s.rep_p) {			// right repeat
					if (!repn) {
						stime += (s.ptim - s.rep_p.ptim) /
								conf.speed * 1000
						s = s.rep_p	// left repeat
						t = stime + s.ptim / conf.speed * 1000
						repn = true
						break
					}
					repn = false
				}
				if (s.rep_s) {			// first variant
					s2 = s.rep_s[++repv]	// next variant
					if (s2) {
						stime += (s.ptim - s2.ptim) /
								conf.speed * 1000
						s = s2
						t = stime + s.ptim / conf.speed * 1000
						repn = false
					} else {		// end of tune
						s = s_end
						break
					}
				}
				while (s.ts_next && s.ts_next.type == C.BAR)
					s = s.ts_next
				break
			case C.BLOCK:
				if (s.subtype == "midictl") {
					i = s.v & 0x0f		// voice = channel
					if ((s.instr & ~0x7f) == 16384) // if percussion
						i = 9		// force the channel 10
					op.send(new Uint8Array([0xb0 + i,
								s.ctrl, s.val]),
						t)
				}
				break
			case C.GRACE:
				for (g = s.extra; g; g = g.next) {
					d = g.pdur / conf.speed * 1000
					for (m = 0; m <= g.nhd; m++) {
						note = g.notes[m]
						note_run(g,
							note.midi,
							t,
//fixme: there may be a tie...
							d)
					}
				}
				break
			case C.NOTE:
				d = s.pdur / conf.speed * 1000
				for (m = 0; m <= s.nhd; m++) {
					note = s.notes[m]
					if (note.ti2)
						continue
					note_run(s,
						note.midi,
						t,
						note.tie_ty ?
							do_tie(s, note.b40, d) : d)
				}
				// fall thru
			case C.REST:
				d = s.pdur / conf.speed * 1000

				// follow the notes/rests while playing
				i = s.istart
				st = t - window.performance.now()
				timouts.push(setTimeout(onnote, st, i, true))
				setTimeout(onnote, st + d, i, false)
				break
			}
			if (s == s_end || !s.ts_next) {
				setTimeout(onend,
					t - window.performance.now() + d,
					repv)
				s_cur = s
				return
			}
			s = s.ts_next
			t = stime + s.ptim / conf.speed * 1000 // next time
			if (t > maxt)
				break
		}
		s_cur = s

		// delay before next sound generation
		timouts.push(setTimeout(play_next,
					t - window.performance.now()
						- 300))	// wake before end of playing
	} // play_next()

	// MIDI output is possible,
	// return the possible ports in return to get_outputs()
	function send_outputs(access) {
	    var	o, os,
		out = []

		Midi5.ma = access	// store the MIDI access in the Midi5 function

		if (access && access.outputs.size > 0) {
			os = access.outputs.values()
			while (1) {
				o = os.next()
				if (!o || o.done)
					break
				out.push(o.value.name)
			}
		}
		rf(out)
	} // send_outputs()

// public methods
	return {

		// get outputs
		get_outputs: function(f) {
			if (!navigator.requestMIDIAccess) {
				f()			// no MIDI
				return
			}
			rf = f

			// open MIDI with SysEx
			navigator.requestMIDIAccess({sysex: true}).then(
				send_outputs,
				function(msg) {

					// open MIDI without SysEx
					navigator.requestMIDIAccess().then(
						send_outputs,
						function(msg) {
							rf()
						}
					)
				}
			)
		}, // get_outputs()

		// set the output port
		set_output: function(name) {
		    var o, os
			if (!Midi5.ma)
				return
			os = Midi5.ma.outputs.values()
			while (1) {
				o = os.next()
				if (!o || o.done)
					break
				if (o.value.name == name) {
					op = o.value
					break
				}
			}
		},

		// play the symbols
		play: function(i_start, i_end, i_lvl) {

			// get the callback functions
			if (conf.onend)
				onend = conf.onend
			if (conf.onnote)
				onnote = conf.onnote

			s_end = i_end
			s_cur = i_start
			repv = i_lvl || 0
if (0) {
// temperament
			op.send(new Uint8Array([
				0xf0, 0x7f,	// realtime SysEx
				0x7f,		// all devices
				0x08,		// MIDI tuning standard
				0x02,		// note change
				0x00,		// tuning prog number
				0x01,		// number of notes
					0x69,		// key
					0x69,		// note
					0x00,		// MSB fract
					0,		// LSB fract
				0xf7		// SysEx end
				]), t)
}

			v_i = []		// must do a reset of all channels
			stime = window.performance.now() + 200	// start time + 0.2s
			play_next()
		}, // play()

		// stop playing
		stop: function() {
			stop = true
			timouts.forEach(function(id) {
						clearTimeout(id)
					})
			onend(repv)
//fixme: op.clear() should exist...
			if (op && op.clear)
				op.clear()
		} // stop()
	} // returned object
} // end Midi5
