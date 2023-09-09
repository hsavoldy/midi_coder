import {globalClock, major, minor, scale,beatsPerMeasure, seqsToStart} from './midi_main.js';
import {muted, midi, outputMidiID} from './midi_control.js';
import {updateStatusBar} from './monitor.js';
import {floor, ceil} from "./midi_math.js"

export var bar = 0;
// export var beat = 0;
var column = [4];
var divID = 'display-box';
// var html = '';
var seqs_dict = {};
export var _ = -999999999;

export function checkSeqs() {
	for (var key in seqs_dict) {
		var seq = seqs_dict[key];
		if (seq.timeForNext()) {
			seq.callback();
			seq.executeStep();
		}
		if (seq.restarted) {
			seqsToStart[key] = seq;
			seq.restarted = false;
		}
	}
}


export function reset() {
	for (var key in seqs_dict) {
		seqs_dict[key].reset();
	}
	globalClock = 0;
}

export function checkChannel(channel) {
	if (channel > 16) {
		console.warn("Cannot have a channel larger than 16. Using channel 1.");
		channel = 1;
	} else if (channel <= 0) {
		channel = 1;
	}
	return channel
}

export function stopEverything() {
	for (let key in seqs_dict) {
		seqs_dict[key].stop();
	}
	seqs_dict = {};
}

export var seqs_dict = {};

export class Seq {
	constructor(vals, durs = 1 / 4, channel = 0) {
		this.vals = vals;
		this.durs = durs;
		this.noteInd = 0;
		this.dursInd = 0;
		this.noteInc = 1;
		this.dursInc = 1;
		this.repopulating = false;
		this.inserting = false;
		this.stopped = false;
		this.nextValTime = globalClock
		this.channel = channel;
		this.velocity = 127;
		this.controllerNum = 7; //volume
		this.restarted = false;
		this.monitor = false;
		this.newVals = [];
		// this.waitingToStart = true;
		this.lastNoteSent = null;
		if (channel > 16) {
			console.warn("Cannot have a channel larger than 16. Setting channel to 1.");
			this.channel = 1;
		}
		this.stepFunc = this.sendNote;
		this.name = '';
		this.octave = 0;
		this.valsName = null;
		this.dursName = null;
	}

	executeStep() {
		this.updateArrays();
		this.stepFunc();
		// this.displayBarBeat();
		// this.display(column[0]);
	}
	// display(col) {
	// 	// add col to column array
	// 	column[0] = col;
	// 	// divID = div;
	// 	var html = 'Sequence \'' + this.name + '\':<br><br>';
	// 	// if (this.name in seqs_dict) {
	// 	// 	html = 'Sequence \'' + this.name + '\':<br><br>';
	// 	// }
	// 	// else {
	// 	// 	// add this.name to seqs_dict
	// 	// 	seqs_dict[this.name] = this;
	// 	// 	// print everything in seqs_dict
	// 	// 	html += 'Sequence \'' + this.name + '\':<br><br>';
	// 	// }
		

	// 	var vals = this.vals.slice();

	// 	if (vals[this.noteInd-1] < -1000) {
	// 		vals[this.noteInd-1] = '_';
	// 	}
	// 	if (vals[this.vals.length-1] < -1000) {
	// 		vals[this.vals.length-1] = '_';
	// 	}
	// 	vals[this.noteInd-1] = '<b>' + vals[this.noteInd-1] + '</b>';
	// 	if (this.noteInd-1 < 0) {
	// 		vals[this.vals.length-1] = '<b>' + vals[this.vals.length-1] + '</b>';
	// 	}
	// 	var count = 0;
	// 	var flag = false;
	// 	for (var i = 0; i < vals.length; i++) {
	// 		if (vals[i] < -1000) {
	// 			vals[i] = '_';
	// 		}
	// 		html += vals[i] + ' ';
	// 		count++;
	// 		if (count == col ) {
	// 			html += '<br>';
	// 			count = 0;
	// 		}
	// 	}
	// 	html += '<br><br>';

	// 	html += 'durations: ';
	// 	var durss = '';
	// 	for (var i = 0; i < this.durs.length; i++) {
	// 			var dur = Math.round(this.durs[i] * 10000) / 10000;
	// 			if (i == this.durs.length - 1) {
	// 				durss += dur;
	// 				break;
	// 			}
	// 			durss += dur + ', ';
	// 	}

	// 	if (durss == '') {
	// 		durss = '0.25';
	// 	}

	// 	html += durss;

	// 	html += '<br>';
	// 	html += 'index: ';
	// 	html += this.noteInd;

	// 	html += '<br>';

	// 	document.getElementById(divID).innerHTML = html;
	// }

	// displayBarBeat() {

	// 	var bar = Math.floor(globalClock/(beatsPerMeasure*24));
	// 	var beat = Math.floor(globalClock/24)-bar*beatsPerMeasure+1;
	// 	bar += 1;

	// 	document.getElementById('bar').innerHTML = bar;
	// 	document.getElementById('beat').innerHTML = beat;
	// }

	sendNoteOff(noteNum) {
		if (noteNum == null | noteNum < 0) {
			return;
		}
		var channel = checkChannel(this.channel);
		const noteOffMessage = [0x80 + channel - 1, noteNum, 0];    // 0x80 note off + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(noteOffMessage);
	}

	//called for every note right before execution
	transform(x) {
		return x;
	}

	sendNote() {
		var noteNum = this.nextVal();
		var velocity = this.velocity;

		//apply transform
		noteNum = this.transform(noteNum);

		if (noteNum == null) {	return;	}
		if (muted) {	return;	}

		var channel = checkChannel(this.channel);

		//send note off if value is not ≈ (tie), e.g. -87654321
		if(noteNum > -900000000 && noteNum < -7000000) return;
		this.sendNoteOff(this.lastNoteSent, this.channel);

		//calculate new midi note based on scale degree and scale
		var midiNote;
		if (scale != null) {
			var accidental = false;
			var adjustedNoteNum = noteNum;
			if(noteNum*10%10!=0){ //is there a decimal?
				adjustedNoteNum = Math.floor(Math.abs(noteNum)) * noteNum/Math.abs(noteNum); //make positive for floor then add back sign
				accidental = true;
			}
    		midiNote = scale.slice(adjustedNoteNum % scale.length)[0] + Math.floor(adjustedNoteNum / scale.length) * 12 + (this.octave * 12);
			
			//increase MIDI note by one if there was a decimal
			if(accidental){
				if(noteNum>0){
					midiNote += 1;
				}else{
					midiNote -= 1;
				}
			}
		}
		else {
			midiNote = noteNum;
		}

		//look for rests
		if (midiNote < 0 || midiNote == null || midiNote > 127) {	return;	}

		//send MIDI msg
		const noteOnMessage = [0x90 + channel - 1, midiNote, velocity];    // 0x90 note on + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(noteOnMessage);
		// updateStatusBar(['midi_output','note',midiNote,velocity]);

		this.lastNoteSent = midiNote;

		//for console logging
		var bar = Math.floor(globalClock / (beatsPerMeasure * 24));
		var beat = Math.floor(globalClock / 24) - bar * beatsPerMeasure + 1;
		bar = bar + 1; //want bar 0 to be bar 1
		if (this.monitor) console.log(this.name + ' midi: ' + midiNote, ' vel: ' + velocity);
	}

	sendCC() {
		var val = this.transform(this.nextVal());
		var paramNum = this.controllerNum;
		var channel = Window.checkChannel(this.channel);
		const ccMessage = [0xB0 + channel - 1, paramNum, val];    // 0xB0 CC + channel, controller number, data

		if (muted) {
			return;
		}

		var output = midi.outputs.get(outputMidiID);
		output.send(ccMessage);
		console.log(ccMessage);
	}

	timeForNext() {
		if (this.stopped) {
			return false;
		}
		if (this.nextValTime <= globalClock) {
			return true;
		} else {
			return false;
		}
	}

	nextVal() {
		if (this.vals.length === 0) {
			this.noteInd = 0;
			return null;
		}
		var note = this.vals[floor(this.noteInd)]
		//this.noteInd = (this.noteInd + 1) % this.vals.length
		//below removes increment and moves this to updateNoteIndex()

		this.updateNoteIndex()
		// while (this.noteInd < 0) this.noteInd += this.vals.length //handle negative indexes
		this.noteInd = (this.noteInd) % this.vals.length

		var nextStep = null;
		if (typeof this.durs !== 'number') {
			nextStep = this.durs[floor(this.dursInd)];
		} else {
			nextStep = this.durs;
		}
		this.nextValTime = globalClock + nextStep * 24 * 4;

		//take care of incrementing durssation index in case where durss is an array
		this.updateDurIndex()
		if (typeof this.durs !== 'number') {
			this.dursInd = (this.dursInd) % this.durs.length
		}

		return note
	}

	updateNoteIndex() { this.noteInd = (this.noteInd + this.noteInc) }
	
	updateDurIndex() { this.dursInd = (this.dursInd + this.dursInc) }

	repopulate() {
		this.newVals = [];
		this.repopulating = true;
	}

	stopPop() {
		if (this.noteInd >= this.newVals.length) {
			this.noteInd = this.newVals.length - 1;
		}
		this.vals = this.newVals;
		this.repopulating = false;
	}

	appendNote(note) {
		this.vals.push(note);
	}

	// insertNoteAt(arrayInd) {
	// 	this.inserting = arrayInd;
	// }

	// insertNote(note) {
	// 	this.vals.splice(this.inserting, 0, note);
	// 	this.inserting = false;
	// }

	stop() {
		this.stopped = true;
		this.sendNoteOff(this.lastNoteSent, this.channel);
	}

	start() {
		this.stopped = false;
	}

	reset() {
		// console.log('reset');
		this.noteInd = 0;
		this.dursInd = 0;
		this.nextValTime = 0; //this.nextValTime - globalClock;
		this.sendNoteOff(this.lastNoteSent, this.channel);
		this.restarted = true;
		this.stop();
	}

	// addFunction(funcName, func) {
	// 	this[funcName] = func;
	// }

	addFunction(func) {
		this['callback'] = func;
	}

	callback() {
		//console.log('here');
		return;
	}

	updateArrays(){	
		if(this.valsName){
			var newVals = eval('globalThis.'+this.valsName);
			this.noteInd = this.noteInd%newVals.length;
			this.vals = newVals;
		}
		if(this.dursName){
			var newDurs = eval('globalThis.'+this.dursName);
			if(Array.isArray(newDurs)){
				this.dursInd = this.dursInd%newDurs.length;
			}
			this.durs = newDurs;
		}
	}

}
