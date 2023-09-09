let inputMsg = [];
let outputMsg = [];
let transport_beat = [];

export function updateStatusBar(info){
	
	switch(info[0]){
		case 'midi_output':outputMsg = info.slice(1); break;
		case 'midi_input': inputMsg = info.slice(1); break;
		case 'beat': transport_beat = info.slice(1); break;
	}
	document.getElementById("lastMidi").innerHTML = 
	'in:' + [inputMsg[0], inputMsg[1], inputMsg[2]] + '\t' +
	'out:' + [outputMsg[0], outputMsg[1], outputMsg[2]] + '\t' +
	'beat:' + [transport_beat[0], transport_beat[1], transport_beat[2]];
}