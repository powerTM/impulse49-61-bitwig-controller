// CC Command mappings:
CC.prototype.command = function() 
{
	// Mode-free commands:
	switch(this.key) {
		case ccRewind.key:
			if ( !midiBtnKnobsOn ) {
				transport.rewind();
				break;
			} else {
				host.scheduleTask(notifyImpulse, ["RE/FF disabled. Press 'Plugin' to re-enable."], 500);
			}

		case ccFastForward.key:
			if ( !midiBtnKnobsOn ) {
				transport.fastForward();
				break;
			} else {
				host.scheduleTask(notifyImpulse, ["RE/FF disabled. Press 'Plugin' to re-enable."], 500);
			}

		case ccStop.key:
			if ( isShift ) {
				device.getParameter(lastAffectedParam).reset();
				clearLastCC(true);
			} else {
				transport.stop();
			}
			
			break;
		case ccPlay.key:
			transport.play();
			break;
		case ccLoop.key:
			transport.toggleLoop();
			break;
		case ccRecord.key:
			if ( isMidiBtnFaders ) {
				bitwig.enter();
			} else {
				transport.record();
			}
			
			break;
		case midiBtnKnobs.key:
			midiBtnKnobsOn = true;
			break;
		case pluginBtn.key:
			midiBtnKnobsOn = false;
			break;
		case shift.key:
			break;

	}

	// General mode commands:
	if ( impulseControlMode === "general" ) {
		if ( isShift ) {

			switch(this.key) {
				case mute1M.key:
					bitwig.toggleInspector();
					break;
				case mute2M.key:
					switch(panelSwap) {
						//bitwigActions[197].invoke(); (Next sub-panel command)
						// Nothing is shown
						case 0:
							bitwig.toggleNoteEditor();
							panelSwap = 1;
							break;
						// Note editor panel is displayed:
						case 1: 
							bitwig.toggleAutomationEditor();
							panelSwap = 2;
							break;
						// Automation editor panel is displayed:
						case 2: 
							bitwig.toggleDevices();
							panelSwap = 3;
							break;
						// Device panel is displayed:
						case 3:
							bitwig.toggleMixer();
							panelSwap = 4;
							break;
						// Mixer panel is displayed:
						case 4:
							bitwig.toggleMixer();
							panelSwap = 0;
							break;
					}
					
					break;
				case mute3M.key: // Has same CC as pageUpBtn.key
					if ( this.midiChan === firstChannel ) {
						bitwig.toggleBrowserVisibility();
					}
					
					break;
				case mute4M.key: // Has same CC as pageDownBtn.key
					if ( this.midiChan === firstChannel ) {
						bitwig.createAudioTrack(cursorTrackPosition+1);
						cursorTrack.selectNext();
						// Select Previous Item 76
						// Select Next Item 77
						// Open contextual browser; API's .startBrowsing() won't work for tracks with empty device chains:
						bitwigActions[431].invoke();
						//bitwigActions[32].invoke();
					}
					
					break;
				case mute5M.key:
					if ( this.midiChan === firstChannel ) { // Allow if key is not shift2:
						bitwig.createEffectTrack(cursorTrackPosition+1);
						cursorTrack.selectNext();
						bitwigActions[431].invoke(); // Open contextual browser;
					}
					break;
				case mute6M.key:
					bitwig.createInstrumentTrack(cursorTrackPosition+1);
					cursorTrack.selectNext();
					bitwigActions[431].invoke(); // Open contextual browser;

					break;
				case muteMasterM.key:
					bitwig.setPanelLayout(nextPanelToDisplay);
					break;
				case nextTrack.key:
					cursorTrack.selectNext();
					break;
				case prevTrack.key:
					cursorTrack.selectPrevious();
					break;
			}
		} 

		else {
			if ( this.midiChan === firstChannel ) {
				switch(this.key) {
					case mute1M.key:
					case mute2M.key:
					case mute3M.key:
					case mute4M.key:
					case mute5M.key:
					case mute6M.key:
					case mute7M.key:
					case mute8M.key:
						changeChannelState(channels[this.slot].slot);
						break;
				}
			}
				
		}
	}

	// Mixing mode commands:
	else if ( impulseControlMode === "mixing" ) {

	}
	// Device control mode commands:
	else if ( impulseControlMode === "device" ) {
		switch(this.key) {
			case mute6.key:
				break;
		}
	}
	
};

// Mapping combo commands to each CC:
CC.prototype.comboCmd = function() 
{
	switch(currentCC + this.name) {
		case ccFastForward.name + ccRewind.name:
			device.switchToPreviousPreset();
			break;
		case ccRecord.name + ccRewind.name:
			bitwig.undo();
			clearLastCC(true);
			break;
		case ccRewind.name + ccFastForward.name:
			device.switchToNextPreset();
			clearLastCC(true);
			break;
		case ccRecord.name + ccFastForward.name:
			bitwig.redo();
			clearLastCC(true);
			break;
		case ccLoop.name + ccRecord.name:
			changeControlMode();
			clearLastCC(true);
			break;
		case ccStop.name + ccRewind.name:
			device.switchToPreviousPresetCategory();
			clearLastCC(true);
			break;
		case ccStop.name + ccFastForward.name:
			device.switchToNextPresetCategory();
			clearLastCC(true);
			break;
	}
};