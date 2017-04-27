/*
*
* novation IMPULSE49/61 controller script for Bitwig.
* Note: remember to change your IMPULSE's template to "blank" - otherwise the script will not run correctly.
*/

/* pre-init() configurations: */
loadAPI(1);
host.defineController("Novation", "Impulse49/61", "1.0", "ED699150-756A-11E5-A837-0800200C9A66", "Nuriel Pele");
host.defineMidiPorts(2, 1);

/*
 * 
 * Automatic device discovery:
 *
 */

if (host.platformIsWindows())
{
	host.addDeviceNameBasedDiscoveryPair(["Impulse", "MIDIIN2 (Impulse)"], ["Impulse"]);
	host.addDeviceNameBasedDiscoveryPair(["Novation Impulse", "MIDIIN2 (Novation Impulse)"], ["Novation Impulse"]);
}
else if (host.platformIsMac())
{
   	host.addDeviceNameBasedDiscoveryPair(["Impulse Impulse", "Impulse Impulse MIDI In"], ["Impulse Impulse"]);
}
else if (host.platformIsLinux())
{
	host.addDeviceNameBasedDiscoveryPair(["Impulse MIDI 1", "Impulse MIDI 2"], ["Impulse MIDI 1"]);
}

var SYSEX_HEADER 	   		= "F0 00 20 29 67",
	ccList 		   	   		= {channel1: [], channel2: []}, // CC index
	channels 		   		= [], // Channels index
	parameters				= [], // Parameters index
	impulseControlMode 		= "general",
	nextPanelToDisplay 		= "MIX",
	mixerFadersForgiveness 	= 3.0,
	knobsForgiveness		= 10.0,
	defaultBrowser 			= "Contextual",
	impulseDebugging 		= false,
	panelSwap 				= 0,
	cursorTrackPosition 	= 0,
	lastAffectedParam 		= 0, // Tells Bitwig which parameter to reset when requested	
	isShift					= false,
	isMidiBtnFaders			= false,
	isMixerBtnFaders		= true,
	isChannelsMuteMode		= true;

load('Impulse49-61-Conf.js');
load('Impulse49-61-Map.js');

// General settings:
var	notePressed    = 144,
	noteReleased   = 128,
	ccOn 	   	   = 127,
	ccOff 	   	   = 0,
	buttonOn       = 1,
	buttonOff      = 0,
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
		"B240??",
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
	//device = host.createCursorDevice(); - Deprecated
	device = host.createEditorCursorDevice();

/*	device.addCanSelectPreviousObserver(function(can){
		println("Can select prev:" + can);
	});
	device.addCanSelectNextObserver(function(can){
		println("Can select next:" + can);
	});*/

	device.addSelectedPageObserver(0,function(page){
		host.scheduleTask(notifyImpulse, ["Params " + page], 500);
	});
	/*> sessionBank.getSession(0).activate()
	> sessionBank.getSession(0).startBrowsing()*/
	deviceBrowser = device.createDeviceBrowser(1,1);
	//sessionBank = deviceBrowser.createSessionBank(1); - Makes Bitwig crash when deviceBrowser.startBrowsing() is used
	cursorBrowser = deviceBrowser.createCursorSession();
/*	testy = deviceBrowser.getDeviceSession().getCategoryFilter().addNameObserver(50, "Cat NA", function(name){
		println(name);
	});*/
	cursorBrowser.addIsActiveObserver(function(active){
		println("Is cursor browser active: " + active);
	});

	cursorBrowser.addNameObserver(20, "Not avail", function(name){
		println("Name of cursor browser: " + name);
	});

	deviceBrowser.getDeviceSession().addIsActiveObserver(function(isit){
		println("Device Brwosing Session active: " + isit);
	});
	deviceBrowser.getDeviceSession().addIsAvailableObserver(function(isit){
		println("Device browsing session is avail:" + isit);
	});

	deviceBrowser.addIsBrowsingObserver(function(isBrowsing){
		println("Device browser is browsin: " + isBrowsing);
	});
	
	device.addHasSelectedDeviceObserver(function(hasSelectedDevice){
		println("Has selected device: " + hasSelectedDevice);
	});

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
	.getNumberSetting("Faders (volume):", "Override Precision", 1.0, 128.0, 1.0, "CC", 3.0)
	.addRawValueObserver(function(forgiveness){ mixerFadersForgiveness = forgiveness; });

	preferencesKnobForgiveness = preferences
	.getNumberSetting("Knobs (device parameters):", "Override Precision", 1.0, 128.0, 1.0, "CC", 10.0)
	.addRawValueObserver(function(forgiveness){ knobsForgiveness = forgiveness ;});
	/* Let users select the default broswer browser they want to browse when creating tracks: */
	preferencesDefaultBrowser = preferences
	.getEnumSetting("Type:", "Browser", ["Contextual", "Simple"], "Contextual")
	.addValueObserver(function(val){ defaultBrowser = val ;});


	preferencesDebuging = preferences.getEnumSetting("Enable debugging?:", "Debugging", ["Yes", "No"], "No")
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
	arranger = host.createArranger();
	trackBank = host.createTrackBank(8,8,8);
	cursorTrack = host.createArrangerCursorTrack(0,0);

	/* Follow position of cursor track in the channels list: */
	cursorTrack.addPositionObserver(function(pos){
		cursorTrackPosition = pos;
	})
	/* 
	 * Channels volume listeners 
	 * 
	*/
	initVolObserverCreator(); // Activate the channel volume observer creator

	for ( var i = 0 ; i < 8 ; i++ ) {
		setChannelVolObserver(i);	
	}

	device.getParameter(0).addValueObserver(128, function(val){
		parameters[0].lastValue = val;
	});

	device.addPositionObserver(function(pos){
		println("Position of device: " + pos);
	})

	// Bitwig hacking:
/*	for ( var prop in bitwigActions[431] ) {
		println("Prop name:" + prop);
		if ( prop === "instance" || prop === "class" || prop === "observers" ) {
			println("///SKIPPED prop name '" + prop + "'///");
			continue;
		}
		println(bitwigActions[431][prop]);
	}

	for ( var prop in cursorTrack ) {
		println("Prop name:" + prop);
		if ( prop === "children" || prop === "observers" || prop === "instance" || prop === "position" || prop === "class") {
			println("///SKIPPED prop name '" + prop + "'///");
			continue;
		}
		println(cursorTrack[prop]);
		println("");
	}*/


	// Not using next/previousPanelLayout() because it won't switch to "EDIT":
	bitwig.addPanelLayoutObserver(function(panel) { 
		nextPanelToDisplay = panel === "MIX" ? "EDIT" : panel === "EDIT" ? "ARRANGE" : "MIX";

	}, 8);

	/* Say hi when controller script is loaded: */
	var ms = 50;
	for ( var i = 0 ; i < padList.length ; i++ ) {
		sendMidi(notePressed, padList[i], ccOn);
		host.scheduleTask(lightShow, [padList[i]], ms);
		ms += 50;
	}

}

function initVolObserverCreator() {
	setChannelVolObserver = function(channel) {
		trackBank.getChannel(channel).getVolume().addValueObserver(128, function(currentVolume) {
			channels[channel].volume = currentVolume;
			//println(i);
		});
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
		if ( action >= fader1M.key && action <= fader8M.key ) {
			if ( status === firstChannel ) {
				setVolume(ccList.channel1[action].slot, value);
			}
			
		} 

		// Check if CC is a knob:
		if ( action >= knob1P.key && action <= knob8P.key && !midiBtnKnobsOn ) {
			if ( status === secondChannel && !isMidiBtnFaders ) {
				knobCC(ccList.channel2[action].slot, value);
			} 
			else if ( isMidiBtnFaders && status === secondChannel ) {
				knobsNavigation(action, value);
			}
		}

		// The following executes on button midi press (127):
		if ( (value === ccOn || value === buttonOn) && status!=178 ) 
		{

			switch(action) {
				// Check if Shift is pressed:
				case shift.key:
					isShift = true;
					break;
				case midiBtnFaders.key:
					isMidiBtnFaders = true;
					isMixerBtnFaders = false;
					break;
				case muteSoloBtn.key:
					isChannelsMuteMode = true;
					isMidiBtnFaders = false; // muteSoloBtn has the same CC as the 'mixer' button next to the faders.
					isMixerBtnFaders = true; 
					break;
				case nextTrack.key:
				case prevTrack.key:
					ccList.channel1[action].command();
					break;
				case pageUpBtn.key:
					if ( status === secondChannel ) {
						device.previousParameterPage();
					}
					
					break;
				case pageDownBtn.key:
					if ( status === secondChannel ) {
						device.nextParameterPage();
					}
					
					break;
				case mute1.key:
				case mute2.key:
				case mute3.key:
				case mute4.key:
				case mute5.key:
				case mute6.key:
				case mute7.key:
				case mute8.key:
				case muteMaster.key:
					ccList.channel1[action].command();
					break;
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
		if ( (value === ccOff || value === buttonOff) && status!=178 )
		{

			// Check if Shift is release:
			if ( action === shift.key ) {
				isShift = false;
			} 
			else if ( action === muteSoloBtn.key ) {
				isChannelsMuteMode = false;
			}
			// Check if CC is a mute / solo button; Disable to keep button lighting logical:
			else if ( action >= mute1.key && action <= muteMaster.key ) {
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
	if ( isChannelsMuteMode ) {
		targetChannel.getMute().toggle();
	} else {
		targetChannel.getSolo().toggle();
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

function openBrowser() {
	// Open contextual browser; 
	// API's .startBrowsing() won't work for tracks with empty device chains,
	// So we're openning the browser from the Bitwig Actions class:
	if ( defaultBrowser === "Contextual" ) {
		bitwigActions[431].invoke();
	// Open simple browser:
	} else {
		//196, 184
		bitwigActions[196].invoke();
		bitwigActions[423].invoke();
	}
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

	if ( value > 63 ) {
		value = isShift ? .1 : 1;
	} else {
		value = isShift ? -.1 : -1;
	}
	device.getParameter(channel).inc(value, resolution);
	
}

function knobsNavigation(knob, value) 
{
	var direction;
	/* Arrow keys navigation: */
	if ( knob === knob1P.key ) {
		if ( value > 63 ) {
			bitwig.arrowKeyDown();
		} else {
			bitwig.arrowKeyUp();
		}
	} 

	if ( knob === knob5P.key ) {
		if ( value > 63 ) {
			bitwig.arrowKeyRight();
		} else {
			bitwig.arrowKeyLeft();
		}
	}
	/* Tabs navigation: */
	if ( knob === knob6P.key ) {
		if ( value > 63 ) {
			bitwigActions[135].invoke(); // Move to next tab
		} else {
			bitwigActions[136].invoke(); // Move to prev tab
		}
	} 

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

