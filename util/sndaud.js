// sndaud5.js - audio output using HTML5 audio
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

// Audio5 creation

// @conf: configuration object - all items are optional:
//	ac: audio context - (default: created on play start)
//	sfu: soundfont URL (sf2 base64 encoded - default: "Scc1t2")
//	onend: callback function called at end of playing
//		Argument:
//			repv: last repeat variant number
//	onnote: callback function called on note start/stop playing
//		Arguments:
//			i: start index of the note in the ABC source
//			on: true on note start, false on note stop
//	instr_load: function to load the sound font of an instrument
//			(optional)
//		Arguments:
//			instr: MIDI instrument number
//			done: callback function in case of success
//				Arguments: soundfont in binary format
//			fail: callback function in case of error
//				no argument
//	errmsg: function called on error (default: alert)
//
//  When playing, the following items must/may be set:
//	gain: (mandatory) volume, must be set to [0..1]
//	speed: (mandatory) must be set to 1
//	new_speed: (optional) new speed value

// Audio5 methods

// get_outputs() - get the output devices
//	return ['sf2'] or null
//
// play() - start playing
// @start -
// @stop: start and stop music symbols
// @level: repeat variant (optional, default = 0)
//
// stop() - stop playing
//
// set_vol() - set the current sound volume
// @volume: range [0..1] - undefined = return current value

    var	abcsf2 = []			// SF2 instruments

function Audio5(i_conf) {
    var	C = abc2svg.C,
	conf = i_conf,		// configuration
	onend = function() {},
	onnote = function() {},
	errmsg = alert,
	ac,			// audio context
	gain,			// global gain

	// instruments/notes
	instr = [],		// [voice] bank + instrument
	params = [],		// [instr][key] note parameters per instrument
	rates = [],		// [instr][key] playback rates
	w_instr = 0,		// number of instruments being loaded

	// -- play the memorized events --
	s_cur,			// current music symbol
	s_end,			// last music symbol / null
	stop,			// stop playing
	repn,			// don't repeat when true
	repv,			// repeat level (variant number)
	stime,			// start playing time
	timouts = []		// note start events

	// default sound font load function
	if (!conf.instr_load) {
		conf.instr_load = function(instr, done, fail) {
			abc2svg.loadjs(conf.sfu + '/' + instr + '.js',
				function() {
					 done(b64dcod(abcsf2[instr]))
				},
				fail
			)
		}
	}

	// base64 stuff
    var b64d = []
	function init_b64d() {
	    var	b64l = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
		l = b64l.length
		for (var i = 0; i < l; i++)
			b64d[b64l[i]] = i
		b64d['='] = 0
	}
	function b64dcod(s) {
	    var	i, t, dl, a,
		l = s.length,
		j = 0

		dl = l * 3 / 4			// destination length
		if (s[l - 1] == '=') {
			if (s[l - 2] == '=')
				dl--
			dl--
			l -= 4
		}
		a = new Uint8Array(dl)
		for (i = 0; i < l; i += 4) {
			t =	(b64d[s[i]] << 18) +
				(b64d[s[i + 1]] << 12) +
				(b64d[s[i + 2]] << 6) +
				 b64d[s[i + 3]]
			a[j++] = (t >> 16) & 0xff
			a[j++] = (t >> 8) & 0xff
			a[j++] = t & 0xff
		}
		if (l != s.length) {
			t =	(b64d[s[i]] << 18) +
				(b64d[s[i + 1]] << 12) +
				(b64d[s[i + 2]] << 6) +
				 b64d[s[i + 3]]
			a[j++] = (t >> 16) & 0xff
			if (j < dl)
				a[j++] = (t >> 8) & 0xff
		}
		return a
	}

	// copy a sf2 sample to an audio buffer
	// @b = audio buffer (array of [-1..1])
	// @s = sf2 sample (PCM 16 bits)
	function sample_cp(b, s) {
	    var	i, n,
		a = b.getChannelData(0)		// destination = array of float32

		for (i = 0; i < s.length; i++)
			a[i] = s[i] / 196608	// volume divided by 6
	}

	// create all notes of an instrument
	function sf2_create(parser, instr) {
	    var i, sid, gen, parm, sampleRate, sample,
		infos = parser.getInstruments()[0].info

		rates[instr] = []
		for (i = 0; i < infos.length; i++) {
			gen = infos[i].generator
			if (!gen.sampleID)	// (empty generator!)
				continue
			sid = gen.sampleID.amount
			sampleRate = parser.sampleHeader[sid].sampleRate
			sample = parser.sample[sid]
			parm = {
				attack: Math.pow(2, (gen.attackVolEnv ?
					gen.attackVolEnv.amount : -12000) / 1200),
				hold: Math.pow(2, (gen.holdVolEnv ?
					gen.holdVolEnv.amount : -12000) / 1200),
				decay: Math.pow(2, (gen.decayVolEnv ?
					gen.decayVolEnv.amount : -12000) / 1200) / 3,
				sustain: gen.sustainVolEnv ?
					(gen.sustainVolEnv.amount / 1000) : 0,
//				release: Math.pow(2, (gen.releaseVolEnv ?
//					gen.releaseVolEnv.amount : -12000) / 1200),
				buffer: ac.createBuffer(1,
							sample.length,
							sampleRate)
			}
			parm.hold += parm.attack
			parm.decay += parm.hold

			// sustain > 40dB is not audible
			if (parm.sustain >= .4)
				parm.sustain = 0.01	// must not be null
			else
				parm.sustain = 1 - parm.sustain / .4

			sample_cp(parm.buffer, sample)

			if (gen.sampleModes && (gen.sampleModes.amount & 1)) {
				parm.loopStart = parser.sampleHeader[sid].startLoop /
					sampleRate
				parm.loopEnd = parser.sampleHeader[sid].endLoop /
					sampleRate
			}

			// define the notes
		    var scale = (gen.scaleTuning ?
					gen.scaleTuning.amount : 100) / 100,
			tune = (gen.coarseTune ? gen.coarseTune.amount : 0) +
				(gen.fineTune ? gen.fineTune.amount : 0) / 100 +
				parser.sampleHeader[sid].pitchCorrection / 100 -
				(gen.overridingRootKey ?
					gen.overridingRootKey.amount :
					parser.sampleHeader[sid].originalPitch)

			for (j = gen.keyRange.lo; j <= gen.keyRange.hi; j++) {
				rates[instr][j] = Math.pow(Math.pow(2, 1 / 12),
							(j + tune) * scale)
				params[instr][j] = parm
			}
		}
	} // sf2_create()

	// load an instrument (.js file)
	function load_instr(instr) {
		w_instr++
		conf.instr_load(instr,
			function(sf2_bin) {
			    var	parser = new sf2.Parser(sf2_bin)
				parser.parse()
				sf2_create(parser, instr)
				if (--w_instr == 0)
					play_start()
			},
			function() {
				errmsg('could not find the instrument ' +
					((instr / 128) | 0).toString() + '-' +
					(instr % 128).toString())
				if (--w_instr == 0)
					play_start()
			})
	} // load_instr()

	// start loading the instruments
	function load_res() {
	    var i,
		s = s_cur

		while (s) {
			i = s.instr
			if (i != undefined && !params[i]) {
				params[i] = []
				load_instr(i)
			}
			s = s.ts_next
		}
	}

	// create a note
	// @s = symbol
	// @key = MIDI key + detune
	// @t = audio start time
	// @d = duration adjusted for speed
	function note_run(s, key, t, d) {
	    var	g, st,
		instr = s.instr,
		parm = params[instr][key | 0],
		o = ac.createBufferSource()

		if (!parm)		// if the instrument could not be loaded
			return		// or if it has not this key
		o.buffer = parm.buffer
		if (parm.loopStart) {
			o.loop = true
			o.loopStart = parm.loopStart
			o.loopEnd = parm.loopEnd
		}
		if (o.detune) {
		    var	dt = (key * 100) % 100
			if (dt)			// if micro-tone
				 o.detune.value = dt
		}
//		o.playbackRate.setValueAtTime(parm.rate, ac.currentTime)
		o.playbackRate.value = rates[instr][key]

		g = ac.createGain()
		if (parm.hold < 0.002) {
			g.gain.setValueAtTime(1, t)
		} else {
			if (parm.attack < 0.002) {
				g.gain.setValueAtTime(1, t)
			} else {
				g.gain.setValueAtTime(0, t)
				g.gain.linearRampToValueAtTime(1, t + parm.attack)
			}
			g.gain.setValueAtTime(1, t + parm.hold)
		}

		g.gain.exponentialRampToValueAtTime(parm.sustain,
					t + parm.decay)

		o.connect(g)
		g.connect(gain)

		// start the note
		o.start(t)
		o.stop(t + d)
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
				d += s.pdur / conf.speed
				return note.tie_ty ? do_tie(s, b40, d) : d
			}
		}

		return d
	} // do_tie()

	// generate 2 seconds of music
	function play_next() {
	    var	d, i, st, m, note, g, s2, t, maxt,
		s = s_cur

		if (stop) {			// stop
			onend(repv)
			return
		}

		while (s.noplay) {
			s = s.ts_next
			if (!s || s == s_end) {
				onend(repv)
				return
			}
		}
		t = stime + s.ptim / conf.speed		// start time

		// if speed change, shift the start time
		if (conf.new_speed) {
			stime = ac.currentTime -
					(ac.currentTime - stime) *
						conf.speed / conf.new_speed
			conf.speed = conf.new_speed
			conf.new_speed = 0
			t = stime + s.ptim / conf.speed
		}

		maxt = t + 2			// max time = now + 2 seconds
		timouts = []
		while (1) {
			switch (s.type) {
			case C.BAR:
				if (s.bar_type.slice(-1) == ':') // left repeat
					repv = 0
				if (s.rep_p) {			// right repeat
					if (!repn) {
						stime += (s.ptim - s.rep_p.ptim) /
								conf.speed
						s = s.rep_p	// left repeat
						t = stime + s.ptim / conf.speed
						repn = true
						break
					}
					repn = false
				}
				if (s.rep_s) {			// first variant
					s2 = s.rep_s[++repv]	// next variant
					if (s2) {
						stime += (s.ptim - s2.ptim) /
								conf.speed
						s = s2
						t = stime + s.ptim / conf.speed
						repn = false
					} else {		// end of tune
						s = s_end
						break
					}
				}
				while (s.ts_next && s.ts_next.type == C.BAR)
					s = s.ts_next
				break
			case C.GRACE:
				for (g = s.extra; g; g = g.next) {
					d = g.pdur / conf.speed
					for (m = 0; m <= g.nhd; m++) {
						note = g.notes[m]
						note_run(g,
							note.midi,
							t + g.ptim - s.ptim,
//fixme: there may be a tie...
							d)
					}
				}
				break
			case C.NOTE:
				d = s.pdur / conf.speed
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
				d = s.pdur / conf.speed

				// follow the notes/rests while playing
				i = s.istart
				st = (t - ac.currentTime) * 1000
				timouts.push(setTimeout(onnote, st, i, true))
				setTimeout(onnote, st + d * 1000, i, false)
				break
			}
			while (1) {
				if (s == s_end || !s.ts_next) {
					setTimeout(onend,
						(t - ac.currentTime + d) * 1000,
						repv)
					s_cur = s
					return
				}
				s = s.ts_next
				if (!s.noplay)
					break
			}
			t = stime + s.ptim / conf.speed	// next time
			if (t > maxt)
				break
		}
		s_cur = s

		// delay before next sound generation
		timouts.push(setTimeout(play_next, (t - ac.currentTime)
			* 1000 - 300))		// wake before end of playing
	} // play_next()

	// wait for all resources, then start playing
	function play_start() {
		if (stop) {			// stop playing
			onend(repv)
			return
		}

		// all resources are there
		gain.connect(ac.destination)
		stime = ac.currentTime + .2		// start time + 0.2s
			- s_cur.ptim * conf.speed
		play_next()
	} // play_start()

	// Audio5 function

	init_b64d()			// initialize base64 decoding

	if (!conf.sfu)
		conf.sfu = "Scc1t2"	// set the default soundfont location

    // public methods
    return {

	// get outputs
	get_outputs: function() {
		return (window.AudioContext || window.webkitAudioContext) ?
				['sf2'] : null
	}, // get_outputs()

	// play the symbols
	play: function(i_start, i_end, i_lvl) {

		// get the callback functions
		if (conf.onend)
			onend = conf.onend
		if (conf.onnote)
			onnote = conf.onnote
		if (conf.errmsg)
			errmsg = conf.errmsg

		// play a null file to unlock the iOS audio
		// This is needed for iPhone/iPad/...
		function play_unlock() {
		    var buf = ac.createBuffer(1, 1, 22050),
			src = ac.createBufferSource()

			src.buffer = buf
			src.connect(ac.destination)
			src.noteOn(0)
		}

		// initialize the audio subsystem if not done yet
		if (!gain) {
			ac = conf.ac
			if (!ac) {
				conf.ac = ac = new (window.AudioContext ||
							window.webkitAudioContext)
				if (/iPad|iPhone|iPod/.test(navigator.userAgent))
					play_unlock()
			}
			gain = ac.createGain()
			gain.gain.value = conf.gain
		}

		s_end = i_end
		stop = false
		while (i_start.noplay)
			i_start = i_start.ts_next
		s_cur = i_start
		repv = i_lvl || 0
		w_instr++
		load_res()
		if (--w_instr == 0)		// all resources are there
			play_start()
	}, // play()

	// stop playing
	stop: function() {
		stop = true
		timouts.forEach(function(id) {
					clearTimeout(id)
				})
		play_next()
		if (gain) {
			gain.disconnect()
			gain = null
		}
	}, // stop()

	// set volume
	set_vol: function(v) {
		if (gain)
			gain.gain.value = v
	} // set_vol()
    } // returned object
} // Audio5()
