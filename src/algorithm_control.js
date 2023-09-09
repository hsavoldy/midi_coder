import { addToEditor, replaceLastLine, replaceString, freezeEditor, unfreezeEditor } from './index.js'
export var makingIf = false;
var algStage = 0;
var curAlg = '';

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
      var makingIf = false;
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