export const starterCode = [
	'setMidiInput(1);',
	'setMidiOutput(1);',
	'midiClock=false;',
	'\n',
	'an = Array.from({length:16},(x,i)=> i%12%5 == 0 ? floor(i/3) : _)',
	'a = new Seq(an, 1/8, 1) //values, durations, midi channel',
	'\n',
	'for(i=0;i<8;i++) addCircle(5)'
	];

//inputs and outputs are the available midi ports
export function createStarterText(midiText){
	var instructions = [
		'To run code:',
		'Ctrl-Enter: Run selected line',
		'Alt-Enter: Run selected block'
		]
	var text = instructions.reduce(
		function (output, str) { return output + '\n' + str ;}
		);

	var code = starterCode.reduce(
		function (output, str) { return output + '\n' + str ;}
		);

	return '/*\n' + text + '\n\n' + midiText + '*/\n\n' + code
}