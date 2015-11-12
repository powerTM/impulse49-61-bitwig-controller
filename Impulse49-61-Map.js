// CC Command mappings:
CC.prototype.command = function() 
{
	// Mode-free commands:
	switch(this.key) {
		case ccRewind.key:
			if ( !midiBtnKnobsOn ) {
				if ( fineTuning ) {
					doFineTuning(-.1);
				} else {
					transport.rewind();
				}
				break;
			} else {
				host.scheduleTask(notifyImpulse, ["RE/FF disabled. Switch back to 'Plugin' to enable."], 500);
			}

		case ccFastForward.key:
			if ( !midiBtnKnobsOn ) {
				if ( fineTuning ) {
					doFineTuning(.1);
				} else {
					transport.fastForward();
				}
				break;
			}

		case ccStop.key:
			transport.stop();
			break;
		case ccPlay.key:
			transport.play();
			break;
		case ccLoop.key:
			transport.toggleLoop();
			break;
		case ccRecord.key:
			transport.record();
			break;
		case midiBtnKnobs.key:
			midiBtnKnobsOn = true;
			break;
		case pluginBtn.key:
			midiBtnKnobsOn = false;
			break;
	}
	
	// General mode commands:
	if ( impulseControlMode === "general" ) {
		switch(this.key) {
			case mute1.key:
				bitwig.toggleInspector();
				break;
			case mute2.key:
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
			case mute3.key:
				bitwig.toggleBrowserVisibility();
				break;
			case mute4.key:
				bitwig.createAudioTrack(cursorTrackPosition+1);
				//cursorTrack.selectNext();
				//bitwigActions[32].invoke();
				break;
			case mute5.key:
				bitwig.createEffectTrack(cursorTrackPosition+1);
				cursorTrack.selectNext();
				break;
			case mute6.key:
				bitwig.createInstrumentTrack(cursorTrackPosition+1);
				cursorTrack.selectNext();
				break;
			case mute7.key:
				cursorTrack.selectPrevious();
				break;
			case mute8.key:
				cursorTrack.selectNext();
				break;
			case muteMaster.key:
				bitwig.setPanelLayout(nextPanelToDisplay);
				break;
		}
	}

	// Mixing mode commands:
	else if ( impulseControlMode === "mixing" ) {
		switch(this.key) {
			case mute1.key:
			case mute2.key:
			case mute3.key:
			case mute4.key:
			case mute5.key:
			case mute6.key:
			case mute7.key:
			case mute8.key:
				changeChannelState(channels[this.slot].slot);
				break;
		}
	}
	// Device control mode commands:
	else if ( impulseControlMode === "device" ) {
		switch(this.key) {
			case muteMaster.key:
				device.getParameter(lastAffectedParam).reset();
				break;
			case mute6.key:
				device.previousParameterPage();
				break;
			case mute7.key:
				device.nextParameterPage();
				break;
			case mute8.key:
				fineTuning = fineTuning ? false : true; // Toggle true/false
				fineTuningStatus = fineTuning ? "Fine Tuning Enabled" : "Fine Tuning Disabled";
				host.scheduleTask(notifyImpulse, [fineTuningStatus], 500);
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