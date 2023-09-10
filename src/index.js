// import { midi, onMIDISuccess, onMIDIFailure, setMidiInput, setMidiOutput, getMidiIO,
// 	handleMidiInput, outputMidiID, midiMap, ccMap, stopMap, mute, muted, toggleMute } from "./midi_control.js";
// import { Seq, seqs_dict, checkSeqs, _, stopEverything, reset} from './seq_control.js'; 
// // import { makingIf, startTern } from "./algorithm_control.js";
// // import { createStarterText, starterCode } from  "./starterCode.js"
// // import {floor, ceil, peak, cos, round, trunc, abs} from './midi_math.js';
// import './algorithm_control.js';
// import './clockWorker.js';
// import './midi_control.js';
// import './midi_math.js';
// import './midi_midiclock.js';
// import './monitor.js';
// import './oscilloscope.js';
// import './seq_control.js';
// import './starterCode.js';
// export * from "./midi_control.js";
// export * from './seq_control.js';
// export * from "./algorithm_control.js";
// export * from "./starterCode.js";
// export * from './midi_math.js';

// import WebWorker from "./workerSetup";
// import ClockWorker from './clockWorker.js';


//const fs = require('fs'); //for reading text files

//http-server -o index.html -p 8000
export var globalClock = 0;
export var beatsPerMeasure = 4;
var noteOns = [];
export var midiClock = false;
var clockWorker = null;
var tempo = 110;
// var muted = false;
export var mapping = false;
export var major = [60, 62, 64, 65, 67, 69, 71];
export var minor = [60, 62, 63, 65, 67, 68, 70];
export var scale = major; //and minor, can add other modes too 
var seqArrays = {}; //to store the names of each seq's named arrays


//send note offs when tab is closed
// addEventListener("unload", (event) => { stopEverything(); });

// var audioCtx = new (window.AudioContext || window.webkitAudioContext);
// Tone.context = audioCtx;

export function enableLiveCoding(code){
	code = code.replace('globalThis.','');
	code = code.replaceAll('midiMain.','');
	var lines = code.split('\n');
	for(var line of lines){
		if(line.includes('//')){ //THIS IS A HEURISTIC FOR COMMENTED OUT LINES
			continue;
		}
		var inputs = removeArray(line).replace('/','').match(/(\w+)\s*=\s*new\s+Seq\((\w+),?\s*(\w+)?,?\s*\d*\)/);
			if(inputs){
				var seqName = inputs[1]; 
				var notes = isNumber(inputs[2]) ? null : inputs[2]; //set to null if notes is a number (at this point, arrays have been converted to numbers)
				var durs = isNumber(inputs[3]) ? null : inputs[3];
				seqArrays[seqName] = [notes, durs];
			}
	}

	code = code.replace('var', '');
	code = code.replace('let', '');
	code = code.replace('const', '');
	//TODO handle lines with comments
	var assignments = code.match(/(\s+(\w+)\s*=\s*([^;]+))|((\w+)\s*=\s*([^;]+))/g);
	if (assignments) {
		for (var i = 0; i < assignments.length; i++) {
			var assignment = assignments[i].match(/\s*(\w+)\s*=\s*([^;]+)/);
			if (assignment) {
				var variableName = assignment[1];
				window[variableName] = eval(assignment[1]);
				//if it's a sequencer, add to list
					if (eval(variableName) instanceof Seq) {
						seqsToStart[variableName] = eval(variableName);
						eval(variableName).valsName = seqArrays[variableName][0];
						eval(variableName).dursName = seqArrays[variableName][1];
					}
			}
		}
	}
}

export function initializeMidiCoder(){
	navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
	// setupClock();

}

export function initialCode(code){
	// navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
	var inputsOutputs = /\/\*\nMIDI Inputs:\n(\d+.*\n)*MIDI Outputs:\n(\d+.*\n?)*\n\*\/\n*/gi
	code = code.replaceAll(inputsOutputs, '');	
	var setMidi = /midiCoder.setMidiInput\(\d+\);\nmidiCoder.setMidiOutput\(\d+\);\n*/gi
	code = code.replaceAll(setMidi, '');	
	if(midi===null){
		return code;
	}
	return '/*\n'+getMidiIO()+'*/' + '\nmidiCoder.setMidiInput(1);\nmidiCoder.setMidiOutput(1);\n'+code;
}

export function setMidiClock(bool){
	midiClock = bool;
	// setupClock();
}

// export function setupClock() {
// 	if (window.Worker) {
// 		// console.log('we tried to make a clock');
// 		// var clockWorker = new Worker(new URL('./clockWorker.js', import.meta.url));

// 		// clockWorker.postMessage({ type: 'start', interval: 1 / (tempo / 60) * 1000 / 24 });

// 		// clockWorker.onmessage = (event) => {
// 		// 	if (!midiClock) {
// 		// 		onClock();
// 		// 	}
// 		// 	const currentTime = event.data;
// 		// 	// clockElement.textContent = currentTime.toLocaleTimeString();
// 		// };

// 		//   clockElement.textContent = currentTime.toLocaleTimeString();

// 		// clockWorker.postMessage('start');
// 	} else {
// 		// Fallback for browsers that don't support Web Workers
// 		console.warn("browser doesn't support internal clock");
// 		// setInterval(() => {
// 		//   const currentTime = new Date();
// 		//   clockElement.textContent = currentTime.toLocaleTimeString();
// 		// }, 1000);
// 	}
// }

export function changeTempo(tempo) {
	var interval = 1 / (tempo / 60) * 1000 / 24;
	tempo = tempo;
	// setupClock();
	// clockWorker.postMessage({ type: 'changeInterval', interval: interval });
}

function changeRow(row){
	beatsPerMeasure = row;
	console.log('beats per measure: ' + beatsPerMeasure);
}

//execute on every incoming tick from midi clock
//24 ppqn
export function onClock() {
	//start new seqs
	if (globalClock % (24 * beatsPerMeasure) == 0) {
		// console.log(seqsToStart);
		// console.log(seqs);
		for (var key in seqsToStart) {
			if (key in seqs_dict) {
				seqs_dict[key].stop();
			}
			seqs_dict[key] = seqsToStart[key];
			seqs_dict[key].name = key;
			seqs_dict[key].start();
		}
		seqsToStart = {};
	}
	globalClock += 1;
	checkSeqs();
	if (mapping != false & globalClock % 10 == 0) {
		console.log('sending');
		const message = [mapping[0], mapping[1], 1];    // 0x80 note off + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(message);
	}
}

//TODO make this less ugly
export function onBeat(){
	//start new seqs
	if (globalClock % (24 * beatsPerMeasure) == 0) {
		// console.log(seqsToStart);
		// console.log(seqs);
		for (var key in seqsToStart) {
			if (key in seqs_dict) {
				seqs_dict[key].stop();
			}
			seqs_dict[key] = seqsToStart[key];
			seqs_dict[key].name = key;
			seqs_dict[key].start();
		}
		seqsToStart = {};
	}
	globalClock += 1;
	checkSeqs();
	if (mapping != false & globalClock % 10 == 0) {
		console.log('sending');
		const message = [mapping[0], mapping[1], 1];    // 0x80 note off + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(message);
	}

}

// document.getElementById("play-button").addEventListener("click", async function () {
// 	unfreezeEditor();
// 	// if (Tone.Transport.state !== 'started') {
// 	// 	await Tone.start();
// 	// 	Tone.Transport.start();
// 	// 	console.log('started');
// 	// } else {
// 	// 	Tone.Transport.stop();
// 	// }
// });

var seqs = []

function changeTimeSig(timeSig) {
	reset();
}

//for user to access
// function sendMidiMessage(note, velocity, channel) {
// 	sendNote(note, velocity, channel);
// }

export var seqsToStart = {}


function checkStringForNonVariable(str){
	for(var i=0;i<str.length;i++) {
		if (str[i]=='(') return true;
		else if (str[i]=='{') return true;
		else if (str[i]=='\t') return true;
		else if (str[i]=='=') return false;
	}
	return false;
}

function isNumber(str){
	return !isNaN(parseInt(str));
}

//replaces all arrays with 0 for regex parsing
function removeArray(str){
	while(str.includes('[')){
		str = str.slice(0, str.indexOf('['))+'0'+str.slice(str.indexOf(']')+1);
	}
	return str;
}

/************************************
 * RUN CODE
 * - main code parser for codemirror
 * ************************************/
// var editor = null;
// function runCode(code) {
// 	console.log(editor);
// 	//alt-x (≈)	generates a musical tie, like _ generates a rest
// 	code = code.replace("≈", -87654321);
	
// 	var lines = code.split('\n');
// 	code = '';

// 	var seqArrays = {}; //to store the names of each seq's named arrays

// 	for (var line of lines) {
// 		if (line[0] === ';') { //sometimes codeMirror begins a line with a semicolon which we need to avoid here
// 				line = line.slice(1);
// 			}

// 		//ignore lines that start with comments
// 		if (line[0] === '/' && line[1] === '/') line = ''

// 		//add 'globalThis.' to every variable to ensure that they are globally scoped in node
// 		//add global.this to all variable definitions
// 		if (checkStringForNonVariable(line)){//true if there is '(' before '='
// 			//e.g.'not a variable'
// 			code += line;
// 		}
// 		else if (line.match(/\s*(\w+)\s*=\s*([^;]+)/)) { //is a variable definition, add globalThis
// 			code += 'globalThis.' + line;
// 		} else { //not a variable declaration- just add it
// 			code += line; 
// 		}

// 		//check for named inputs to Seq so we can let them be redefined
// 		//this lets us pass an array to Seq and updates to the array are
// 		//passed through to the seq
// 		var inputs = removeArray(line).replace('/','').match(/(\w+)\s*=\s*new\s+Seq\((\w+),?\s*(\w+)?,?\s*\d*\)/);
// 		if(inputs){
// 			var seqName = inputs[1]; 
// 			var notes = isNumber(inputs[2]) ? null : inputs[2]; //set to null if notes is a number (at this point, arrays have been converted to numbers)
// 			var durs = isNumber(inputs[3]) ? null : inputs[3];
// 			seqArrays[seqName] = [notes, durs];
// 		}
// 		code += ';';  //enable multiple lines to execute at once
// 	}
// 	//if the code contains a "startTern", we just want to start the algorithm. Don't execute the code.
// 	if(code.indexOf('startTern')!==-1){
// 		startTern();
// 		return;
// 	}

// 	//console.log(code)
// 	eval(code);


// 	var assignments = code.match(/(globalThis\.\s+(\w+)\s*=\s*([^;]+))|(globalThis\.(\w+)\s*=\s*([^;]+))/g);
// 	if (assignments) {
// 		for (var i = 0; i < assignments.length; i++) {
// 			var assignment = assignments[i].match(/globalThis\.\s*(\w+)\s*=\s*([^;]+)/);
// 			if (assignment) {
// 				var variableName = assignment[1];
// 				window[variableName] = eval(assignment[1]);
// 				//if it's a sequencer, add to list
// 					if (eval(variableName) instanceof Seq) {
// 						seqsToStart[variableName] = eval(variableName);
// 						eval(variableName).valsName = seqArrays[variableName][0];
// 						eval(variableName).dursName = seqArrays[variableName][1];
// 					}
// 			}
// 		}
// 	}
// }

// function evaluateBlock() {
// 	try {
// 		var positions = [];
// 		let linepos = editor.getCursor().line;
// 		var line = editor.getLine(linepos);
// 		while (line.replace(/\s/g, "") != '') {
// 			positions.push(linepos);
// 			linepos = linepos - 1;
// 			line = editor.getLine(linepos);
// 			if (line == undefined) {
// 				break;
// 			}
// 		}
// 		linepos = editor.getCursor().line + 1
// 		line = editor.getLine(linepos)
// 		if (line != undefined) {
// 			while (line.replace(/\s/g, "") != '') {
// 				positions.push(linepos);
// 				linepos = linepos + 1;
// 				line = editor.getLine(linepos);
// 				if (line == undefined) {
// 					break;
// 				}
// 			}
// 		}
// 		positions.sort();
// 		var codeToRun = ';'
// 		for (var position of positions) {
// 			codeToRun += editor.getLine(position) + '\n';
// 		}
// 		runCode(codeToRun);
// 	} catch (e) {
// 		console.error(e);
// 	}

// }

// function evaluateLine() {
// 	try {
// 		let pos = editor.getCursor()
// 		var line = editor.getLine(pos.line)
// 		runCode(line);
// 	} catch (e) {
// 		console.error(e);
// 	}

// }

// function evaluateCode() {
// 	var code = editor.getValue();
// 	try {
// 		runCode(code);
// 	} catch (e) {
// 		console.error(e);
// 	}
// }

// /************************************
//  * 
//  * INITIALIZE CODEBOX
//  * 
//  * ************************************/
// var editor = null;
// export function initialCode(code) {
// 	let starterText = createStarterText(getMidiIO());
// 	return starterText
	// editor = CodeMirror(document.body, {
	// 	extraKeys: {
	// 		'Ctrl-Enter': evaluateLine,
	// 		//'Shift-Enter': evaluateCode,
	// 		'Ctrl-.': stopEverything,
	// 		'Alt-Enter': evaluateBlock,
	// 	},
	// 	//value: instructions + '\n' + midiInputs + '\n' + midiOutputs + '\n' + midiCodeExample + '\n\na = new Seq([1,3,2,4]);\n',
	// 	value: starterText,
	// 	mode: "javascript"
	// });
	// editor.setSize()
// } //initialize codebox

//add stringToAdd to the end of the codebox
export function addToEditor(stringToAdd) {
	// var lineCount = editor.lineCount(); // Get the total number of lines
	// var lastLine = editor.getLine(lineCount - 1); // Get the content of the last line
	// var lastLineEnd = editor.posFromIndex(editor.indexFromPos({ line: lineCount - 1, ch: 0 })) + lastLine.length; // Calculate the end position of the last line

	// var newLineContent = stringToAdd; // The content of the new line

	// // Add the new line at the end
	// editor.replaceRange("\n" + newLineContent, editor.posFromIndex(lastLineEnd));

	// // Update line numbers
	// editor.refresh();
	return;
}

//replace the last line with stringToReplace
export function replaceLastLine(stringToReplace) {
	// var lineCount = editor.lineCount(); // Get the total number of lines
	// var lastLine = lineCount - 1; // Index of the last line
	// var lastLineText = editor.getLine(lastLine); // Get the content of the last line
	// var lastLineStart = { line: lastLine, ch: 0 }; // Start position of the last line
	// var lastLineEnd = { line: lastLine, ch: lastLineText.length }; // End position of the last line

	// // Replace the entire contents of the last line with the new content
	// editor.replaceRange(stringToReplace, lastLineStart, lastLineEnd);

	// // Update line numbers
	// editor.refresh();
	return;
}

//Search for stringToReplace in the codebox and replace the last instance of it with newString
export function replaceString(stringToReplace, newString) {
	// var cursor = editor.getSearchCursor(stringToReplace);
	// var lineNumber = -1;

	// while (cursor.findNext()) {
	// 	lineNumber = cursor.from().line;
	// }

	// if(lineNumber===-1){
	// 	console.warn("couldn't find string");
	// 	return;
	// }
	
	// var lineText = editor.getLine(lineNumber); // Get the content of the line
	// var startOfString = lineText.lastIndexOf(stringToReplace);
	// var lineStart = { line: lineNumber, ch: startOfString}; // Start position of the last line
	// var lineEnd = { line: lineNumber, ch: startOfString + stringToReplace.length }; // End position of the last line
	// // Replace the entire contents of the last line with the new content
	// editor.replaceRange(newString, lineStart, lineEnd);

	// // Update line numbers
	// editor.refresh();
	return;
}

export function freezeEditor(){
	// editor.setOption("readOnly", "nocursor");
	return;
}

export function unfreezeEditor(){
	// editor.setOption("readOnly", false);
	return;
}

var algStage = 0;
var curAlg = '';
var makingIf = false;

export function startTern() {
   makingIf = true;
   freezeEditor();

   var searchString = "startTern()";
   curAlg = '(x';
   replaceString(searchString, curAlg);
   // var cursor = editor.getSearchCursor(searchString);
   // var lineNumber = -1;

   // while (cursor.findNext()) {
   //   lineNumber = cursor.from().line;
   // }

   // // addToEditor(curAlg);
   // console.log("Send midi note < 60 to cycle through operators and midi note > 60 to select the current one.");
}

var opInd = 0;
var valInd = 0;
var parenCount = 1;
var stage = 0;
var ternStage = 0;

var ternSymbols = ['?', ':'];
var operators = ['>=', '<=', '==', '*', '/', '+', '-', ' '];
var operatorRanges = [15, 31, 46, 72, 87, 103, 118, 127]; //change this to change which operators are easier to land on
var vals = ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', '(', ')', 'x'];
var valRanges = [11, 23, 34, 46, 57, 69, 80, 92, 103, 115, 127];
var numbers = [...Array(25).keys()].map(x => (x - 12).toString()); //populates an array with ints -12 to 12
vals = vals.concat(numbers);
var terminate = false;

//cycle through operators with midi note > 60, finish stage with midi note < 60.
//Change values with any CC messages, end stage with note on message
export function createTernStatement(message) {
   var oldAlg = curAlg; //use this to replace oldAlg with curAlg in the codebox

   if (isCC(message)) {
      if (stage % 2 == 0) { //val stage

         //find the new val by iterating through ranges
         var newValInd = null;
         for (let i = 0; i < valRanges.length; i++) {
            if (message[2] <= valRanges[i]) {
               newValInd = i;
               break;
            }
         }

         curAlg = curAlg.slice(0, curAlg.lastIndexOf(vals[valInd])) + vals[newValInd];
         valInd = newValInd;

      } else { //operator stage

         var newOpInd = null;  
         for (let i = 0; i < operatorRanges.length; i++) {
            if (message[2] <= operatorRanges[i]) {
               newOpInd = i;
               break;
            }
         }
         curAlg = curAlg.slice(0, curAlg.lastIndexOf(operators[opInd])) + operators[newOpInd];
         opInd = newOpInd;
      }
   } else if (isNoteOn(message)) {
      //a space indicates that the next stage of the ternary should occur, so check for this condition
      if (operators[opInd] == ' ' && ternStage < 3) {
         curAlg = curAlg.slice(0, curAlg.length - 1); //remove excess space
         if (ternStage == 2) { //we've reached the end of the ternary, so we should terminate
            terminate = true;
         } else {
            curAlg += ternSymbols[ternStage]; //add next ternary operator
            ternStage += 1;
         }
      }

      if (!terminate) {
         if (stage % 2 == 0) {
            curAlg += ' ' + operators[0]; //add initial operator
         } else {
            curAlg += ' ' + vals[0]; //add initial val
         }
      } else {
         curAlg += ')'; //to close out the terminating ternary
      }

      stage += 1;
      opInd = 0;
      valInd = 0;
   }
   replaceString(oldAlg, curAlg);

   if (terminate) { //reset everything- the ternary is complete
      var opInd = 0;
      var valInd = 0;
      makingIf = false;
      var terminate = false;
      //unfreezeEditor();
      return;
   }
}

//Ifs are not currently functional (they aren't used in midi_main)
function startIf() {
   makingIf = true;
   addToEditor('\n');
   curAlg = 'if(x >=';
   addToEditor(curAlg);
}

//cycle through operators with midi note > 60, finish stage with midi note < 60.
//Change values with any CC messages, end stage with note on message
function createIfStatement(message) {
   var midiNote = message[1];
   var midiStatus = message[0];
   var operators = ['>=', '<=', '=='];
   switch (algStage) {
      case 0:
         if (isNoteOn(message)) { //change operator
            if (midiNote >= 60) {
               var curOperatorInd = operators.indexOf(curAlg.slice(curAlg.length - 2));
               var nextOperatorInd = (curOperatorInd + 1) % operators.length;
               curAlg = curAlg.slice(0, curAlg.length - 2) + operators[nextOperatorInd];
            } else {
               console.log('elsing');
               algStage += 1;
               curAlg += ' 0){';
            }
            replaceLastLine(curAlg);
         }
         break;
      case 1:
         if (isCC(message)) { //change compare value
            var valIndex = curAlg.indexOf('=') + 2;
            var newVal = message[2];
            curAlg = curAlg.slice(0, valIndex) + newVal + '){';
            replaceLastLine(curAlg);
         } else if (isNoteOn(message)) {
            curAlg = '\treturn 0;';
            algStage += 1;
            addToEditor(curAlg);
         }
         break;
      case 2:
         if (isCC(message)) { //change true return
            valIndex = curAlg.indexOf('n') + 2;
            newVal = message[2];
            curAlg = curAlg.slice(0, valIndex) + newVal + ';';
            replaceLastLine(curAlg);
         } else if (isNoteOn(message)) {
            addToEditor('}else{');
            curAlg = '\treturn 0;';
            algStage += 1;
            addToEditor(curAlg);
         }
         break;
      case 3:
         if (isCC(message)) { //change false return
            valIndex = curAlg.indexOf('n') + 2;
            newVal = message[2];
            curAlg = curAlg.slice(0, valIndex) + newVal + ';';
            replaceLastLine(curAlg);
         } else if (isNoteOn(message)) {
            algStage += 1;
         }
         break;
      default:
         break;
   }
}

//true if message is a note on message
function isNoteOn(message) {
   return (message[0] >= 144 && message[0] <= 159);
}

//true if message is a CC message
function isCC(message) {
   return (message[0] >= 176 && message[0] <= 191);
}

export var midi = null;
export var muted = false;

export var outputMidiID = null;

export var midiMsgs = {};
export var ccCallbacks = {};
export var beat = 0;

// eval('globalThis.setMidiInput1 = setMidiInput;');
export function onMIDISuccess(midiAccess) {
	console.log("MIDI ready!");
	midi = midiAccess;  // store in the global
	// Tone.Transport.start()

	// initializeCodeBox();
}


export function onMIDIFailure(msg) {
	console.error(`Failed to get MIDI access - ${msg}`);
}

export var midi_input_ids = {};
export var midi_output_ids = {};
export var midi_input_names = {};
export var midi_output_names = {};

export function getMidiIO(){
	var midiInputs = 'MIDI Inputs:\n';
	var midiOutputs = 'MIDI Outputs:\n';
	var inputID = null;
	var outputID = null;

	var num = 1;
	for (var output of midi.outputs) {
		midiOutputs += num + ': ' + output[1].name + '\n'; //+ '\', ID: \'' + output[1].id + '\'\n';
		outputID = output[1].id;
		midi_output_ids[num] = outputID;
		midi_output_names[num] = output[1].name;
		num += 1;
	}

	num = 1;
	for (var input of midi.inputs) {
		midiInputs += num + ': ' + input[1].name + '\n'; // + '\', ID: \'' + input[1].id + '\'\n';
		inputID = input[1].id;
		midi_input_ids[num] = inputID;
		midi_input_names[num] = input[1].name;
		num += 1;
	}
	return midiInputs + midiOutputs
}

export function setMidiInput(inputID) {
	//in case only one id is inputted, turn into array
	if (!Array.isArray(inputID)) {
		inputID = [inputID];
	}

	//reset inputs
	midi.inputs.forEach(function (key, val) {
		// console.log(key)
		key.onmidimessage = null;
	})

	for (var id of inputID) {
		if (id in midi_input_ids & midi.inputs.get(midi_input_ids[id]) != null) {
			midi.inputs.get(midi_input_ids[id]).onmidimessage = handleMidiInput;
			console.log("MIDI input set to: " + midi_input_names[id]);
		} else {
			console.warn('Invalid input ID');
		}
	}
}
export function setMidiOutput(outputID) {
	if (Array.isArray(outputID)) {
		console.warn('Can only handle one MIDI output. Please enter one ID.')
	}
	if (outputID in midi_output_ids & midi.outputs.get(midi_output_ids[outputID]) != null) {
		outputMidiID = midi_output_ids[outputID];
		console.log("MIDI output set to: " + midi_output_names[outputID]);
	} else {
		console.warn('Invalid output ID');
	}
}
export function handleMidiInput(message) {
	if (message.data[1] != null) {
		let msg_type = 'note'
		if((message.data[0]>>4)==11)msg_type = 'cc'
		//could parse notes to output pitches, e.g. C4 etc.
		//could parse CCs to look for mod wheel, pitch bend, etc.
		// updateStatusBar(['midi_input', msg_type, message.data[1], message.data[2]]);
		//document.getElementById("lastMidi").innerHTML = [message.data[0], message.data[1], message.data[2]];
	}
	if (midiClock) {
		getMIDIClock(message);
	}
	if (makingIf) {
		if (message.data[2] > 0) { //only respond to note on messages
			createTernStatement(message.data);
		}
	} else {
		midiReset(message);
		handleNote(message);
		handleCC(message);
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


function getMIDIClock(message) {
	var command = message.data[0];
	if (command == 248) {
		onClock();
	}
	if (globalClock % 24 == 0) {
		beat += 1;
	}

}

function handleCC(message){
	var command = message.data[0];
	var note = message.data[1];
	var value = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command
	if (command >= 176 & command <= 191) { //may be higher than 176 depending on channel number
		midiMsgs[note] = value;
		eval('globalThis.CC'+note+'='+value+';');
		try{
			eval('CC'+note+'_func')();
		}catch{}
	}

}

function handleNote(message) {
	var command = message.data[0];
	var note = message.data[1];
	var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command
	if (command >= 144 & command <= 159) { //note on- may be higher than 144 depending on channel number
		midiMsgs[note] = velocity;		
		try{
			eval('midi'+note%12+'_func')();
		}catch{}
		for (var key in seqs_dict) {
			var seq = seqs_dict[key];
			if (seq.repopulating) {
				seq.newVals.push(note);
			}
			if (seq.inserting) {
				seq.vals.push(note);
			}

		}
	}else if(command >= 128 & command <=143){ //note off
		midiMsgs[note] = null;
	}
}

export function midiMap(num) {
	mapping = [0x90, num];
	muted = true;
}

export function ccMap(num) {
	mapping = [0xB0, num];
	muted = true;
}

export function stopMap() {
	//stop last message just in case
	const noteOffMessage = [0x80, mapping[1], 0];    // 0x80 note off + channel, midi pitch num, velocity
	var output = midi.outputs.get(outputMidiID);
	output.send(noteOffMessage);

	mapping = false;
	muted = false;
}


export function mute() {
	muted = true;
}

export function unmute() {
	muted = false;
}

export function toggleMute() {
	muted = !muted;
}

export let floor = function(val){
	if(val < -100000) return _
	return Math.floor(val)
 }
 
 
 export let ceil = function(val){
	if(val < -100000) return _
	return Math.ceil(val)
 }
 
 
 export let peak = function(val){
	if(val < -100000) return _
	return Math.ceil(val)
 }
 
 
 export let round = function(val){
	if(val < -100000) return _
	return Math.round(val)
 }
 
 
 export let trunc = function(val){
	if(val < -100000) return _
	return Math.trunc(val)
 }
 
 
 export let abs = function(val){
	if(val < -100000) return _
	return Math.abs(val)
 }
 
 
 export let cos = function(val){
	if(val < -100000) return _
	return Math.cos(val)
 }


var Oscilloscope = Oscilloscope || function(target, context) {
	var _drawWave, _bufferLength, _dataArray;

	this.target = document.querySelector(target);

	// Set the dimensions based on the target container
	this.width = this.target.offsetWidth;
	this.height = this.target.offsetHeight;

	// Create the oscilloscopt wave element
	this.wave = document.createElementNS("http://www.w3.org/2000/svg", 'path');
	this.wave.setAttribute('class', 'oscilloscope__wave');

	// Create the oscilloscope svg element
	this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	this.svg.setAttribute('width', this.width);
	this.svg.setAttribute('height', this.height);
	this.svg.setAttribute('class', 'oscilloscope__svg');
	this.svg.appendChild(this.wave);

	// Append the svg element to the target container
	this.target.appendChild(this.svg);

	// Add the audio context or create a new one
	this.audioContext = context || new window.AudioContext();

	// Indicates if the oscilloscope is running
	this.running = false;

	// Is the oscilloscope analyser-node connected to the audio-context' destination
	this.hasAudio = false;

	// Set-up the analyser-node which we're going to use to get the oscillation wave
	this.analyserNode = this.audioContext.createAnalyser();
	this.analyserNode.fftSize = 128;
	_bufferLength = this.analyserNode.frequencyBinCount;
	_dataArray = new Uint8Array(_bufferLength);

	/**
	 * Draw the oscillation wave
	 */
	_drawWave = function() {
		 var path = 'M';

		 this.analyserNode.getByteTimeDomainData(_dataArray);

		 _dataArray.forEach(function(point, i) {
			  path += (((this.width + (this.width / _bufferLength))/ _bufferLength) * i) + ' ' + ((this.height / 2) * (point / 128.0)) + ', ';
		 }.bind(this));

		 this.wave.setAttribute('d', path);

		 if (this.running) {
			  window.requestAnimationFrame(_drawWave);
		 }
	}.bind(this);

	/**
	 * Start the oscilloscope
	 */
	this.start = function() {
		 this.running = true;

		 window.requestAnimationFrame(_drawWave);
	}.bind(this);
};

/**
* Stop the oscilloscope
*/
Oscilloscope.prototype.stop = function() {
	this.running = false;
};

/**
* Connect the analyser-node to another audio-node
* @param  {audioNode} node An audio-node to connect to
*/
Oscilloscope.prototype.connect = function(node) {
	this.analyserNode.connect(node);
};

/**
* Connect the analyser-node to the audio-context' destination
*/
Oscilloscope.prototype.toggleAudio = function() {
	if (!!this.hasAudio) {
		 this.analyserNode.disconnect();
	} else {
		 this.analyserNode.connect(this.audioContext.destination);
	}

	this.hasAudio = !this.hasAudio;
};
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
