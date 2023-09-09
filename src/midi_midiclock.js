//http-server -o index.html -p 8000
var midi = null;  // global MIDIAccess object
var outputIds = [];
var row = 0;
var pop = false;
var dialOffset = 21;
var padOffset = 36;
var lastNoteVal = 0;
var enableInd = 0;
var selectedSeq = null;
var globalClock = 0;
var beatsPerMeasure = 4;
var beat = 0;
var noteOns = [];
var _ = -999999999;
var midiClock = false;
var clockWorker = null;
var tempo = 60;

function onMIDISuccess(midiAccess) {
	console.log("MIDI ready!");
	midi = midiAccess;  // store in the global
	Tone.Transport.start()

	initializeCodeBox();
	setupClock();

}
function onMIDIFailure(msg) {
	console.error(`Failed to get MIDI access - ${msg}`);
}

function setMidiInput(inputID) {
	if(midi.inputs.get(inputID)!=null){
		midi.inputs.get(inputID).onmidimessage = handleMidiInput;
		console.log("MIDI input set to " + inputID);
	}else{
		console.warn('Invalid input ID');
	}
}
function setMidiOutput(outputID) {
	if(midi.outputs.get(outputID)!=null){
		outputMidiID = outputID;
		console.log("MIDI output set to " + outputID);
	}else{
		console.warn('Invalid output ID');
	}
}

function setupClock(){
	if (window.Worker) {
		clockWorker = new Worker('clockWorker.js');
		
		clockWorker.onmessage = (event) => {
			if(!midiClock){
				onClock();
			}
	   const currentTime = event.data;
	   // clockElement.textContent = currentTime.toLocaleTimeString();
	};
 
	clockWorker.postMessage({ type: 'start', interval: 1/(tempo / 60)*1000/24 });
 
		//   clockElement.textContent = currentTime.toLocaleTimeString();
	 
		// clockWorker.postMessage('start');
	 } else {
		// Fallback for browsers that don't support Web Workers
		console.warn("browser doesn't support internal clock");
		// setInterval(() => {
		//   const currentTime = new Date();
		//   clockElement.textContent = currentTime.toLocaleTimeString();
		// }, 1000);
	 }
}

function changeRow(row){
	beatsPerMeasure = row;
	console.log('beats per measure: ' + beatsPerMeasure);
}

function changeTempo(tempo){
	var interval = 1/(tempo / 60)*1000/24;
	clockWorker.postMessage({ type: 'changeInterval', interval: interval });
}

function handleMidiInput(message) {
	if(message.data[1]!=null){
		document.getElementById("lastMidi").innerHTML = [message.data[0], message.data[1], message.data[2]];
	}
	if(midiClock){
		getMIDIClock(message);
	}
	midiReset(message);
}

function onClock(){
	//start new seqs
	if(globalClock%(24*beatsPerMeasure)==0){
		// console.log(seqsToStart);
		// console.log(seqs);
		for (var key in seqsToStart) {
			if(key in seqs_dict){
				seqs_dict[key].stop();
			}
			seqs_dict[key] = seqsToStart[key];
		}
		seqsToStart = {};
	}
	// console.log('tick');
	globalClock += 1;
	checkSeqs();
}

function getMIDIClock(message) {
	var command = message.data[0];
	if (command == 248) {
		onClock();
	}
	if(globalClock%24==0){
		beat += 1;
	}

}

function midiReset(message) {
	var command = message.data[0];
	if (command == 250) {
		console.log("midi start");
		reset();
	} else if (command == 255) {
		console.log("midi reset");
		reset();
	}

}

function checkChannel(channel){
	if (channel > 16) {
		console.warn("Cannot have a channel larger than 16. Using channel 1.");
		channel = 1;
	} else if (channel <= 0) {
		channel = 1;
	}
	return channel
}

function sendNote(noteNum, velocity, channel) {
	if(noteNum==null){
		return;
	}else if(noteNum<0){
		return;
	}
	channel = checkChannel(channel);
	const noteOnMessage = [0x90 + channel - 1, noteNum, velocity];    // 0x90 note on + channel, midi pitch num, velocity
	// console.log(0x90 + channel);
	var output = midi.outputs.get(outputMidiID);
	output.send(noteOnMessage);
	var bar = Math.floor(globalClock/(beatsPerMeasure*24));
	var beat = Math.floor(globalClock/24)-bar*beatsPerMeasure+1;
	bar = bar +1; //want bar 0 to be bar 1
	console.log('bar: ' + bar + ' beat: ' + beat + ' pitch: ' + noteNum, ' velocity: ' + velocity);
}

//TODO put these two into the same function 
function sendNoteOff(noteNum, channel){
	if(noteNum==null|noteNum<0){
		return;
	}
	channel = checkChannel(channel);
	const noteOffMessage = [0x80 + channel - 1, noteNum, 0];    // 0x80 note off + channel, midi pitch num, velocity
	var output = midi.outputs.get(outputMidiID);
	output.send(noteOffMessage);
}

function checkSeqs() {
	for (var key in seqs_dict) {
		var seq = seqs_dict[key];
		if (seq.timeForNext()) {
			seq.callback();
			sendNoteOff(seq.lastNoteSent, seq.channel);
			var note = seq.nextNote()
			var velocity = seq.velocity;
			seq.lastNoteSent = note;
			sendNote(note, velocity, seq.channel);
		}
	}
}

function reset() {
	for (var key in seqs_dict) {
		seqs_dict[key].reset();
	}
	globalClock = 0;
}

document.getElementById("play-button").addEventListener("click", async function () {
	if (Tone.Transport.state !== 'started') {
		await Tone.start();
		Tone.Transport.start();
		console.log('started');
	} else {
		Tone.Transport.stop();
	}
});

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

var seqs = []
var seqs_dict = {};

class Seq {
	constructor(notes, dur = 1/4, channel = 0) {
		this.notes = notes;
		this.dur = dur;
		this.noteInd = 0;
		this.durInd = 0;
		this.timeSinceLast = 0;
		this.repopulating = false;
		this.inserting = false;
		this.stopped = false;
		this.nextNoteTime = globalClock
		this.channel = channel;
		this.velocity = 127;
		// this.waitingToStart = true;
		this.lastNoteSent = null;
		if (channel > 16) {
			console.warn("Cannot have a channel larger than 16. Setting channel to 1.");
			this.channel = 1;
		}
	}

	timeForNext() {
		// if(this.waitingToStart){
		// 	if(globalClock%(beatsPerMeasure*24)==0){
		// 		this.waitingToStart=false;
		// 	}else{
		// 		return false;
		// 	}
		// }
		if (this.stopped) {
			return false;
		}
		if (this.nextNoteTime <= globalClock) {
			return true;
		} else {
			return false;
		}
	}

	nextNote() {
		if (this.notes.length === 0) {
			this.noteInd = 0;
			return null;
		}
		var note = this.notes[this.noteInd]
		this.noteInd = (this.noteInd + 1) % this.notes.length

		//take care of incrementing duration index in case where dur is an array
		if (typeof this.dur !== 'number') {
			this.durInd = (this.durInd + 1) % this.dur.length
		}
		this.timeSinceLast = 0;

		var nextStep = null;
		if (typeof this.dur !== 'number') {
			nextStep = this.dur[this.durInd];
		} else {
			nextStep = this.dur;
		}
		this.nextNoteTime = globalClock + nextStep * 24 * 4;

		return note
	}

	repopulate() {
		this.notes = [];
		this.repopulating = true;
	}

	stopPop() {
		this.repopulating = false;
	}

	addNote(note) {
		this.notes.push(note);
	}

	insertNoteAt(arrayInd) {
		this.inserting = arrayInd;
	}

	insertNote(note) {
		this.notes.splice(this.inserting, 0, note);
		this.inserting = false;
	}

	stop() {
		this.stopped = true;
		sendNoteOff(this.lastNoteSent, this.channel);
	}

	start() {
		this.stopped = false;
	}

	reset() { //must be called before resetting the globalClock
		console.log('reset');
		this.noteInd = 0;
		this.durInd = 0;
		this.nextNoteTime = this.nextNoteTime - globalClock;
		sendNoteOff(this.lastNoteSent, this.channel);
	}

	addFunction(funcName, func) {
		this[funcName] = func;
	}

	callback(){
		//console.log('here');
		return;
	}

}

function changeTimeSig(timeSig) {
	reset();
}

//for user to access
// function sendMidiMessage(note, velocity, channel) {
// 	sendNote(note, velocity, channel);
// }

seqsToStart = {}

function runCode(code){
	var result = eval(code);
	var assignments = code.match(/(\s+(\w+)\s*=\s*([^;]+))|((\w+)\s*=\s*([^;]+))/g);
	if (assignments) {
		for (var i = 0; i < assignments.length; i++) {
			var assignment = assignments[i].match(/(\w+)\s*=\s*([^;]+)/);

			if (assignment) {
				var variableName = assignment[1];
				//if it's a sequencer, add to list
				if(eval(variableName) instanceof Seq){
					seqsToStart[variableName] = eval(variableName);
				}
			}
		}
	}

}


function evaluateBlock(){
	try {
		var positions = [];
		let linepos = editor.getCursor().line;
		var line = editor.getLine(linepos);
		while(line.replace(/\s/g, "")!=''){
			positions.push(linepos);
			linepos = linepos - 1;
			line = editor.getLine(linepos);
			if(line==undefined){
				break;
			}
		}
		linepos = editor.getCursor().line+1
		line = editor.getLine(linepos)
		if(line!=undefined){
			while(line.replace(/\s/g, "")!=''){
				positions.push(linepos);
				linepos = linepos + 1;
				line = editor.getLine(linepos);
				if(line==undefined){
					break;
				}
			}
		}
		positions.sort();
		var codeToRun = ';'
		for(var position of positions){
			codeToRun += editor.getLine(position)+'\n';
		}
		runCode(codeToRun);
	} catch (e) {
		console.error(e);
	}

}

function evaluateLine() {
	try {
		let pos = editor.getCursor()
		var line = editor.getLine(pos.line)
		runCode(line);
	} catch (e) {
		console.error(e);
	}

}

function evaluateCode() {
	var code = editor.getValue();
	try {
		runCode(code);
	} catch (e) {
		console.error(e);
	}
}

function stopEverything(){
	for (var key in seqs_dict) {
		seqs_dict[key].stop();
	}
	seqs_dict = {};
}

function initializeCodeBox() {
	midiInputs = '//MIDI Inputs:\n';
	midiOutputs = '//MIDI Outputs:\n';
	inputID = null;
	outputID = null;

	for (var output of midi.outputs) {
		midiOutputs += '//Name: \'' + output[1].name + '\', ID: \'' + output[1].id + '\'\n';
		outputID = output[1].id;
	}

	for (var input of midi.inputs) {
		midiInputs += '//Name: \'' + input[1].name + '\', ID: \'' + input[1].id + '\'\n';
		inputID = input[1].id;
	}

	midiCodeExample = 'setMidiInput(inputID);\nsetMidiOutput(outputID);\nmidiClock=false;'

	editor = CodeMirror(document.body, {
		extraKeys: {
			'Ctrl-Enter': evaluateLine,
			//'Shift-Enter': evaluateCode,
			'Ctrl-.': stopEverything,
			'Alt-Enter': evaluateBlock
		},
		value: midiInputs + '\n' + midiOutputs + '\n' + midiCodeExample + '\n\na = new Seq([55, 60, 67, 71]);\n',
		mode: "javascript"
	});
	editor.setSize()
}
