/*
*
* novation IMPULSE49/61 controller script for Bitwig.
* Note: remember to change your IMPULSE's template to "blank", otherwise the script will not run correctly.
*/

/* pre-init() configurations: */
loadAPI(1);
host.defineController("Novation", "Impulse49/61", "1.0", "ED699150-756A-11E5-A837-0800200C9A66", "Nuriel Pele");
host.defineMidiPorts(1, 1);

/*
 * 
 * Automatic device discovery:
 *
 */

host.addDeviceNameBasedDiscoveryPair(["Impulse", "MIDIIN2 (Impulse)"], ["Impulse"]);

for ( var i = 1; i < 9; i++ ) 
{
	var name = i.toString() + "- Impulse";
	host.addDeviceNameBasedDiscoveryPair( [name], [name] );
	host.addDeviceNameBasedDiscoveryPair( ["Impulse MIDI " + i.toString()], ["Impulse MIDI " + i.toString()] );
}


var SYSEX_HEADER 	   		= "F0 00 20 29 67",
	ccList 		   	   		= {channel1: [], channel2: []}, // CC index
	channels 		   		= [], // Channels index
	parameters				= [], // Parameters index
	impulseControlMode 		= "general",
	nextPanelToDisplay 		= "MIX",
	mixerFadersForgiveness 	= 3.0,
	knobsForgiveness		= 10.0,
	fineTuning 				= false, // Allows for a finer parameter adjustment when true
	impulseDebugging 		= false,
	panelSwap 				= 0,
	cursorTrackPosition 	= 0,
	lastAffectedParam 		= 0; // Used to tell Bitwig which parameter to reset when requested	

load('Impulse49-61-Conf.js');
load('Impulse49-61-Map.js');

// General settings:
var	notePressed    = 144,
	noteReleased   = 128,
	ccOn 	   	   = 127,
	ccOff 	   	   = 0,
	transportOn    = 1,
	transportOff   = 0,
	currentCC      = "",
	disableNextCc  = 0,
	midiBtnKnobsOn = false,
	firstChannel   = 176,
	secondChannel  = 177;


function init()
{
	println("experimental");
	bitwigVersion = host.getHostVersion();
	/* CC midi actions listener: */
	host.getMidiInPort(0).setMidiCallback(onMidi);
	host.getMidiInPort(0).setSysexCallback(onSysex);
	host.getMidiOutPort(0).setShouldSendMidiBeatClock(true);

	sendSysex(SYSEX_HEADER + "06 01 01 01 F7");
	sendSysex(SYSEX_HEADER + "07 19 F7");
/*	sendChannelController(60, 48 + 5, 0);
	sendChannelController(0xb1, 10, 127);*/

	/* Keyboard notes listener: */
	var impulseNotes = host.getMidiInPort(0).createNoteInput(
		"Novation Impulse49/61 Keyboard", 
		"80????", // Note keys releases 
		"90????", // Note keys presses
		"B?01??", 
		"B040??", 
		"D0????", // Pressure on
		"E000??", // Pitch wheel
		"E07F7F"  // Pitch wheel 127
	);
	impulseNotes.setShouldConsumeEvents(false);
	/* Transport view listener: */
	transport = host.createTransport();
	/* Bitwig application listener */
	bitwig = host.createApplication();
	/* Devices listener: */
	device = host.createCursorDevice();

	device.addSelectedPageObserver(0,function(page){
		host.scheduleTask(notifyImpulse, ["Params " + page], 500);
	});

	deviceBrowser = device.createDeviceBrowser(1,1);
	deviceBrowser.getDeviceSession().addIsActiveObserver(function(isBrowsing) {
		println("Browsing: " + isBrowsing);
	})
	
	device.addHasSelectedDeviceObserver(function(hasSelectedDevice){
		println(hasSelectedDevice);
	})
	/* Listen to device preset changes and report to Impulse */
	device.addPresetNameObserver(20, "Bitwig", function(presetName){
		host.scheduleTask(notifyImpulse, [presetName], 500);
	});

	/* Listen to device preset category changes and report to Impulse */
	device.addPresetCategoryObserver(20, "Bitwig", function(categoryName){
		host.scheduleTask(notifyImpulse, [categoryName], 500);
	});

	/****************************************************** 
	 * Preferences - set, get & listen to user preferences. 
	 * ****************************************************
	 */
	preferences = host.getPreferences();
	/* Mixer faders precision forgiveness - Allows the user to determine how "forgiving" Bitwig
	 * will be to mixer faders trying to re-adjust an existing volume value in a given channel.
	 */
	preferencesFaderForgiveness = preferences
	.getNumberSetting("Channel Volume:", "Mixer Faders Forgiveness", 1.0, 128.0, 1.0, "CC", 3.0)
	.addRawValueObserver(function(forgiveness){ mixerFadersForgiveness = forgiveness; });

	preferencesKnobForgiveness = preferences
	.getNumberSetting("Device Parameters:", "Knobs Forgiveness", 1.0, 128.0, 1.0, "CC", 10.0)
	.addRawValueObserver(function(forgiveness){ knobsForgiveness = forgiveness ;});


	preferencesDebuging = preferences.getEnumSetting("Enable Debugging?", "Debugging", ["Yes", "No"], "No")
	.addValueObserver(function(val){
		impulseDebugging = val === "Yes" ;
		if ( impulseDebugging ) { println("Debugging..."); }
	});

	bitwigActions = bitwig.getActions();

/*	var y = 0;

	while ( y < bitwigActions.length ) {
		println(bitwigActions[y].getName() + " " + y);
		y++;
	}*/

	/* Mixer listener: */
	mixer = host.createMixer();
	deviceVisible = mixer.isDeviceSectionVisible();
	//arranger = host.createArranger();
	trackBank = host.createTrackBank(8,8,8);
	cursorTrack = host.createArrangerCursorTrack(0,0);
	cursorDevice = host.createEditorCursorDevice();

	/* Follow position of cursor track in the channels list: */
	cursorTrack.addPositionObserver(function(pos){
		cursorTrackPosition = pos;
	})
	/* 
	 * Channels volume listeners 
	 * ( not using a loop to assign them because for some reason loops won't assign anything ) 
	*/
	trackBank.getChannel(0).getVolume().addValueObserver(128, function(currentVolume) {
		channels[0].volume = currentVolume;
	});
	trackBank.getChannel(1).getVolume().addValueObserver(128, function(currentVolume) {
		channels[1].volume = currentVolume;
	});
	trackBank.getChannel(2).getVolume().addValueObserver(128, function(currentVolume) {
		channels[2].volume = currentVolume;
	});
	trackBank.getChannel(3).getVolume().addValueObserver(128, function(currentVolume) {
		channels[3].volume = currentVolume;
	});
	trackBank.getChannel(4).getVolume().addValueObserver(128, function(currentVolume) {
		channels[4].volume = currentVolume;
	});
	trackBank.getChannel(5).getVolume().addValueObserver(128, function(currentVolume) {
		channels[5].volume = currentVolume;
	});
	trackBank.getChannel(6).getVolume().addValueObserver(128, function(currentVolume) {
		channels[6].volume = currentVolume;
	});
	trackBank.getChannel(7).getVolume().addValueObserver(128, function(currentVolume) {
		channels[7].volume = currentVolume;
	});

	device.getParameter(0).addValueObserver(128, function(val){
		parameters[0].lastValue = val;
	});

	device.addPositionObserver(function(pos){
		println(pos);
	})



	// Not using next/previousPanelLayout() because it won't switch to "EDIT":
	bitwig.addPanelLayoutObserver(function(panel) { 
		nextPanelToDisplay = panel === "MIX" ? "EDIT" : panel === "EDIT" ? "ARRANGE" : "MIX";

	}, 8);

	// TEST:
/*	for ( var i = 0 ; i < 8 ; i++ ) {
		trackBank.getChannel(i).getVolume().addValueObserver(128, makeIndex(i, function(currentVolume) {
			channels[i].volume = currentVolume;
		}));
	}*/

	/* Say hi when controller script is loaded: */
	var ms = 50;
	for ( var i = 0 ; i < padList.length ; i++ ) {
		sendMidi(notePressed, padList[i], ccOn);
		host.scheduleTask(lightShow, [padList[i]], ms);
		ms += 50;
	}

}

function makeIndex(index, f)
{
	return function(value) {
		f(index, value);
		println(value);
	}
}

/*
 * Send midi actions to Bitwig
 * @param status int - status of midi input
 * @param action int - requested midi action
 * @param value int  - value of midi action
 */
function onMidi(status, action, value)
{

	if ( impulseDebugging ) {
		printMidi(status, action, value);
	}
	

	// Check if last midi action was a key combination. 
	// If action was a key combination, disable upcoming action:
	if ( disableNextCc > 0 ) {
		disableNextCc -= 1;

		if ( impulseDebugging ) {
			println("Midi disabled");
		}
		
		clearLastCC();
		return;
	}

	// Check if current midi is legit:
	if ( isChannelController(status) ) {


		// Check if CC is a mixer fader:
		if ( action >= fader1.key && action <= fader8.key ) {
			setVolume(ccList.channel1[action].slot, value);
		} 

		// Check if CC is a knob:
		if ( action >= knob1.key && action <= knob8.key && midiBtnKnobsOn ) {
			// We are forced to assign a specific action for knobs 7/8 since
			// Impulse assigns them the same CC as RW/FF on the transport:
			switch(action) {
				case knob7.key:
					knobCC(6, value);
					break;
				case knob8.key:
					knobCC(7, value);
					break;
				default:
					knobCC(ccList.channel1[action].slot, value);	
			}
			return;

		} else if ( action >= knob1P.key && action <= knob8P.key && !midiBtnKnobsOn ) {
			if ( status === secondChannel ) {
				knobCC(ccList.channel2[action].slot, value);
			}
			
		}

		// The following executes on button midi press (127):
		if ( value === ccOn || value === transportOn ) 
		{
			// Check if CC is a mute / solo button:
			if ( action >= mute1.key && action <= muteMaster.key ) {
				ccList.channel1[action].command();
				return;
			}

			// Check if current CC combination means anything:
			if ( status === firstChannel ) {
				ccList.channel1[action].comboCmd(currentCC);
			} else {
				ccList.channel2[action].comboCmd(currentCC);
			}
			
			currentCC = ccList.channel1[action].name;

		}

		// The following execute on button midi release (0)
		if ( value === ccOff || value === transportOff ) 
		{

			// Check if CC is a mute / solo button; Disable to keep button lighting logical:
			if ( action >= mute1.key && action <= muteMaster.key ) {
				return;
			}

			clearLastCC();

			if ( status === firstChannel ) {
				ccList.channel1[action].command(); // Run default action for released midi CC
			} else {
				ccList.channel2[action].command();
			}
			
		}

	}
}

/*
 * Switch between mute / solo / normal for the channel in question
 * @param channelSlot {int} - the channel number in the trackBank. 
 */
function changeChannelState(channelSlot) {
	var targetChannel = trackBank.getChannel(channelSlot);

	switch(channels[channelSlot].state) {
		case 0:
			channels[channelSlot].state = 1;
			targetChannel.getSolo().set(false);
			targetChannel.getMute().set(true);
			break;
		case 1:
			channels[channelSlot].state = 2;
			targetChannel.getMute().set(false);
			targetChannel.getSolo().set(true);
			break;
		case 2:
			channels[channelSlot].state = 0;
			targetChannel.getMute().set(false);
			targetChannel.getSolo().set(false);
			break;
	}
}

/*
 * This function changes how Impulse controls Bitwig.
 */
function changeControlMode() 
{
	var modeText;
	switch(impulseControlMode) 
	{
		case "general":
			impulseControlMode = "mixing";
			modeText = "M: Mixing";
			host.scheduleTask(notifyImpulse, [modeText], 500);
			break;
		case "mixing":
			impulseControlMode = "device";
			modeText = "M: Device Control";
			host.scheduleTask(notifyImpulse, [modeText], 500);
			break;
		case "device":
			impulseControlMode = "general";
			modeText = "M: General";
			host.scheduleTask(notifyImpulse, [modeText], 500);
			break;
	}		
}

/*
 * Send notifications to Impulse's LCD screen
 */
function notifyImpulse(text) {
	sendSysex(SYSEX_HEADER + "08" + text.toHex(text.length) + " F7");
}

/* 
 * Turns off pads light when requested. 
 * @param pad(int): pad light to turn off.
 */
function lightShow(pad) {
	sendMidi(noteReleased, pad, ccOff);
}

/* Set channel volume according to mixer fader CC: */
function setVolume(channel, value, resolution) 
{
	resolution = resolution == null ? 128 : resolution;

	/* 	
	 * The following lines provide protection from overwriting existing fader volumes.
	 * A margin of 2 midi CC is set instead of 1, which is too restricting -
	 * 1 won't send CC to faders unless appyling a very slow motion.
	 */

	if ( 
		channels[channel].volume > value + mixerFadersForgiveness || 
		channels[channel].volume < value - mixerFadersForgiveness 
	) {	return; } 

	else {
		trackBank.getChannel(channel).getVolume().set(value, resolution);
	}
	
}

function knobCC(channel, value, resolution) 
{
	resolution = resolution == null ? 128 : resolution;

	lastAffectedParam = parameters[channel].slot;

	if ( 
		parameters[channel].lastValue > value + knobsForgiveness || 
		parameters[channel].lastValue < value - knobsForgiveness 
	) {	return; } 

	device.getParameter(channel).set(value, resolution);
	
}

function doFineTuning(value) {
	device.getParameter(lastAffectedParam).incRaw(value);
}

/* 
 * Block upcoming status 128 (button released status) CC  
 * to prevent other CC commands from executing:
*/
function clearLastCC(disableNext) {

	if ( disableNext === true ) {

	/* 
	 * disableNextCc = 2 because there are two upcoming CC to cancel
	 * ( every button release == action; a combination of two CC 
	 * pressed at the same time == two release statuses being sent to bitwig ) 
	 */
		disableNextCc = 2;
	}

	currentCC = "";
}

function onSysex(data)
{
	if ( impulseDebugging ) {
		println("SysEx: " + data);
	}
	
}

function exit(){}

