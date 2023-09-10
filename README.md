# midi_coder

midi_coder is a library for creating highly-modifiable javascript sequencers.

## Installation

Simply include midi_coder.js in your project.

## Setup

```javascript
import * as midiCoder from './midi_coder.js';

//To make midiCoder accessible from the code
window.midiCoder = midiCoder;

//Initialization
midiCoder.initializeMidiCoder();

//Replace the initial code in order to show and select midi ports
value = midiCoder.initialCode(value);

//To use live coding functionality. 'string' is the codebox contents
midiCoder.enableLiveCoding(string);

//To use clock, either setup a Tone.js loop...
const loop = new Tone.Loop((time) => {
 	midiCoder.onClock();
 }, "8n").start(0);

//...or use midi clock
midiCoder.setMidiClock(true);


```


## Usage

```javascript
//This code will autopopulate from midiCoder.initialCode
/*
MIDI Inputs:
1: loopMIDI Port
2: loopMIDI Port 1
MIDI Outputs:
1: loopMIDI Port
2: loopMIDI Port 1
*/
midiCoder.setMidiInput(1); //run these lines to select input and output
midiCoder.setMidiOutput(1);

//Create a sequencer
var a = new midiCoder.Seq([1,2],[1/4,1/2]);

//Add the sequencer to the dictionary to get called
midiCoder.seqs_dict['a']=a;

```
