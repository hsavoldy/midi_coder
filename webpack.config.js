const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'midi_coder.js',
    globalObject: 'this',
    library: {
      name: 'midiCoder',
      type: 'umd',
    },
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
};