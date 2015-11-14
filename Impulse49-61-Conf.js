/* 
Mappings:
*/

/*
* 
* Button ( fader, knobs, etc. ) settings:
* 
*/

var CC = function(key, name, midiChan) 
	{
		midiChan = midiChan == null ? 176 : midiChan;
		this.key = key;
		this.name = name;
		this.midiChan = midiChan;

		// Add to ccList.channel1 for quick access:
		if ( midiChan === 176 ) {
			ccList.channel1[key] = this; 
		} else {
			ccList.channel2[key] = this; 
		}
		

	};

/*
 * Fader sliders setup
 */
var Fader = function(key, name, channel, slot) {
	CC.call(this, key, name, channel);
	this.slot = slot;
}

Fader.prototype = CC.prototype;
Fader.prototype.constructor = Fader;

/*
 * Knobs setup
 */
var Knob = function(key, name, channel, slot, lastValue) {
	CC.call(this, key, name, channel);
	this.slot = slot;
	this.lastValue = lastValue;
	parameters[slot] = this;
}

Knob.prototype = CC.prototype;
Knob.prototype.constructor = Knob;

/* 
 * Channel setup 
 * @param slot {int} (0 - 8) - coresponding mixer fader on the Impulse keyboard 
 * @param volume {int} (0-127) - volume of channel
 * @param state {int}; 0 - normal, 1 - muted, 2 - soloed.
 */

var Channel = function(slot, volume, state)
{
	this.slot = slot;

	if ( volume === undefined ) {
		volume = 67;
	}

	this.volume = volume;

	// Defaults channel to normal mode
	if ( state === undefined ) {
		state = 0;
	}

	this.state = state;

	// Add channel to channels index:
	channels[slot] = this;
}

var midiBtnKnobs  	= new CC(8, "midiBtnKnobs", 177), // "MIDI" / "Page down" button next to knobs 
	pluginMixerMidi = new CC(9, "pluginMixerMidi", 177), // "< Mixer" mode - sent when "Plugin" + "MIDI" are pressed together
	pluginBtn 		= new CC(10, "pluginBtn", 177), // "Plugin" / "Page Up" button next to knobs
	pageUpBtn		= new CC(11, "pageUpBtn", 177), // The result of holding shift + "Plugin" button
	pageDownBtn 	= new CC(12, "pageDownBtn", 177), // The result of holding shift + "MIDI" button
	midiBtnFaders  	= new CC(33, "midiBtnFaders", 176), // "MIDI" / "Bank Down" button next to faders:
	//Clashes with the mutu/solo button:
	//mixerBtn 		= new CC(34, "mixerBtn", ), // "Mixer" / "Bank Up" button next to faders 
	muteSoloBtn		= new CC(34, "mutuSoloBtn", 176), // Switches between mute / solo - when "Mixer" button is on
	nextTrack 		= new CC(37, "nextTrack", 176), // The result holding shift + ">" (Under the "Transpose" section)
	prevTrack 		= new CC(38, "prevTrack", 176), // The result holding shift + "<" (Under the "Transpose" section)
	shift 			= new CC(39, "shift", 176),
	shift2 			= new CC(13, "shift2", 177),
	/* Knobs: */
	knob1 = new Knob(21, "knob1", 176, 0),
	knob2 = new Knob(22, "knob2", 176, 1),	
	knob3 = new Knob(23, "knob3", 176, 2),
	knob4 = new Knob(24, "knob4", 176, 3),
	knob5 = new Knob(25, "knob5", 176, 4),
	knob6 = new Knob(26, "knob6", 176, 5),	
	knob7 = new Knob(27, "knob7", 176, 6),
	knob8 = new Knob(28, "knob8", 176, 7),

	/* Knobs - plugin mode: */
	knob1P = new Knob(0, "knob1P", 177, 0),
	knob2P = new Knob(1, "knob2P", 177, 1),	
	knob3P = new Knob(2, "knob3P", 177, 2),
	knob4P = new Knob(3, "knob4P", 177, 3),
	knob5P = new Knob(4, "knob5P", 177, 4),
	knob6P = new Knob(5, "knob6P", 177, 5),	
	knob7P = new Knob(6, "knob7P", 177, 6),
	knob8P = new Knob(7, "knob8P", 177, 7),

	/* Transport buttons: */
	ccRewind 	  	= new CC(27, "rw"),
	ccFastForward 	= new CC(28, "ff"),
	ccStop 		  	= new CC(29, "stop"),
	ccPlay 		  	= new CC(30, "play"),
	ccLoop 		  	= new CC(31, "loop"),
	ccRecord 	  	= new CC(32, "record"),

	/* Pads: */
	pad1 = new CC(60, "pad1"),
	pad2 = new CC(61, "pad2"),
	pad3 = new CC(62, "pad3"),
	pad4 = new CC(63, "pad4"),
	pad5 = new CC(64, "pad5"),
	pad6 = new CC(65, "pad6"),
	pad7 = new CC(66, "pad7"),
	pad8 = new CC(67, "pad8"),

	/* Faders: */
	fader1 = new Fader(41, "fader1", 176, 0),
	fader2 = new Fader(42, "fader2", 176, 1),
	fader2 = new Fader(43, "fader3", 176, 2),
	fader2 = new Fader(44, "fader4", 176, 3),
	fader2 = new Fader(45, "fader5", 176, 4),
	fader2 = new Fader(46, "fader6", 176, 5),
	fader2 = new Fader(47, "fader7", 176, 6),
	fader8 = new Fader(48, "fader8", 176, 7),
	fader9 = new Fader(49, "masterFdr", 176),

	/* Faders - mixer mode: */
	fader1M = new Fader(0, "fader1M", 176, 0),
	fader2M = new Fader(1, "fader2M", 176, 1),
	fader3M = new Fader(2, "fader3M", 176, 2),
	fader4M = new Fader(3, "fader4M", 176, 3),
	fader5M = new Fader(4, "fader5M", 176, 4),
	fader6M = new Fader(5, "fader6M", 176, 5),
	fader7M = new Fader(6, "fader7M", 176, 6),
	fader8M = new Fader(7, "fader8M", 176, 7),
	fader9M = new Fader(8, "masterFdrM", 176),

	/* Mute / solo buttons: */
	mute1 = new Fader(51, "mute1", 176, 0),
	mute2 = new Fader(52, "mute2", 176, 1),
	mute3 = new Fader(53, "mute3", 176, 2),
	mute4 = new Fader(54, "mute4", 176, 3),
	mute5 = new Fader(55, "mute5", 176, 4),
	mute6 = new Fader(56, "mute6", 176, 5),
	mute7 = new Fader(57, "mute7", 176, 6),
	mute8 = new Fader(58, "mute8", 176, 7),
	muteMaster = new Fader(59, "muteMaster", 176, 8),

	/* Mute / solo buttons - mixer mode: */
	mute1M = new Fader(9, "mute1M", 176, 0),
	mute2M = new Fader(10, "mute2M", 176, 1),
	mute3M = new Fader(11, "mute3M", 176, 2),
	mute4M = new Fader(12, "mute4M", 176, 3),
	mute5M = new Fader(13, "mute5M", 176, 4),
	mute6M = new Fader(14, "mute6M", 176, 5),
	mute7M = new Fader(15, "mute7M", 176, 6),
	mute8M = new Fader(16, "mute8M", 176, 7),
	muteMasterM = new Fader(17, "muteMasterM", 176, 8),


	/* Channel mappings: */
	channel1 = new Channel(0),
	channel2 = new Channel(1),
	channel3 = new Channel(2),
	channel4 = new Channel(3),
	channel5 = new Channel(4),
	channel6 = new Channel(5),
	channel7 = new Channel(6),
	channel8 = new Channel(7),
	channel9 = new Channel(8),

	padList = [
	pad1.key, 
	pad2.key,
	pad3.key,
	pad4.key,
	pad5.key,
	pad6.key,
	pad7.key,
	pad8.key
];