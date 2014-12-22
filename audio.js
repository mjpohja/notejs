var ac = new webkitAudioContext();

var instrumentStorage = {};

var freq = function(halfSteps) {
    return Math.pow(Math.pow(2, 1/12), halfSteps) * 220;
}

var sine = function(freq) {
    var sine = ac.createOscillator();
    sine.frequency.setValueAtTime(freq, ac.currentTime);
    var amp = ac.createGain();
    sine.connect(amp);
    amp.connect(ac.destination);
    amp.gain.setValueAtTime(0.3, ac.currentTime);
    
    return { node: sine, amp: amp };
};

var majorChord = function(step) {
    var first = sine(freq(step));
    var third = sine(freq(step + 4));
    var fifth = sine(freq(step + 7));
    return {
        first: first,
        third: third,
        fifth: fifth,
        start: function() {
            first.start();
            third.start();
            fifth.start();
        },
        stop: function() {
            first.stop();
            third.stop();
            fifth.stop();
        }
    }
}

var minorChord = function(step) {
    var first = sine(freq(step));
    var third = sine(freq(step + 3));
    var fifth = sine(freq(step + 7));
    return {
        first: first,
        third: third,
        fifth: fifth,
        start: function() {
            first.start();
            third.start();
            fifth.start();
        },
        stop: function() {
            first.stop();
            third.stop();
            fifth.stop();
        }
    }
}

var wNoise = function(gain) {
    var bufferSize = 2 * ac.sampleRate;
    var noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    var output = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    var whiteNoise = ac.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    
    var hpf = ac.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 4000;
    whiteNoise.connect(hpf);

    var amp = ac.createGain();
    amp.gain.setValueAtTime(gain, ac.currentTime);
    hpf.connect(amp);
    amp.connect(ac.destination);
    return whiteNoise;
}

// [decay, startFreq, endFreq]
var playRamp = function(values, time) {
    var decay = values[0];
    var start = values[1];
    var end = values[2];
    var sine = ac.createOscillator();
    var amp = ac.createGain();
    sine.type = "saw";
    sine.connect(amp);
    amp.connect(ac.destination);
    sine.frequency.setValueAtTime(start, ac.currentTime);
    sine.frequency.exponentialRampToValueAtTime(end, ac.currentTime + (1/decay));
    amp.gain.setValueAtTime(0, ac.currentTime);
    amp.gain.linearRampToValueAtTime(1, ac.currentTime + 0.001);
    amp.gain.setValueAtTime(1, ac.currentTime + 0.3 * time);
    amp.gain.linearRampToValueAtTime(0, ac.currentTime + time/1000);
    sine.noteOn(ac.currentTime);
    sine.noteOff(ac.currentTime + time/1000);
};

// []
var playOsc = function(freq, time, gain) {
    var sine = ac.createOscillator();
    var amp = ac.createGain();
    sine.connect(amp);
    amp.connect(ac.destination);
    sine.frequency.setValueAtTime(freq, ac.currentTime);
    amp.gain.setValueAtTime(gain, ac.currentTime);
    sine.noteOn(ac.currentTime);
    sine.noteOff(ac.currentTime + time / 1000);
};



var firstStep = 0;
var nextStep = 0;
var tempo = 120;
var timeInterval = null;

var click = function() {
    var now = new Date().getTime();
    if( now >= nextStep ) {
        attached.forEach(function(cb) { cb(); });
        nextStep = now + timeInterval;
    }
};

var startSync = function() {
    firstStep = (new Date()).getTime();
    timeInterval = (1000 * 60) / tempo;
    setInterval(click, timeInterval / 2);
};

var attached = [];

var attachToLoop = function(callback) {
    attached.push(callback);
};

// Snare
var snare = function() { 
    var time = 80; 
    var noise = wNoise(0.3, "highpass", 3000, 20); 
    var osc = playRamp([10, 120, 80], time, 0.1); 
    //setTimeout(function() { playRamp([10, 80, 70], time, 0.3); }, 30); 
    
    setTimeout(function() { noise.start(); }, 0);
    setTimeout(function() { noise.stop(); }, time * 2);
}

var kick = function() {
  playRamp([10, 200, 40], 300);
}

var hihat = function() {
  var time = 30; 
  var noise = wNoise(0.2, "highpass", 10000);
  setTimeout(function() { noise.start(); }, 0); 
  setTimeout(function() { noise.stop(); }, time);
}

var bell = function(f) {
  var s = sine(freq(f));
  s.amp.gain.setValueAtTime(0, ac.currentTime);
  var e = new Envelope(ac, 0.01, 0.5, 0.4, 1.0);
  e.connect(s.amp.gain);
  s.node.start();
  return function() { e.trigger(); };
}


var majorScale = [0, 2, 4, 5, 7, 9, 11];

// Testing

var scaleTest = function(scale) {
  var currentNote = 0;
  var end = 10;
  var noteTime = 500;
  var factor = -1;
  var playNext = function(prevNote) {
    if( prevNote ) {
      prevNote.stop();
    }
    if( currentNote % scale.length === 0 ) {
      ++factor;
    }
    var note = sine(freq((factor * (scale.length + 1)) + scale[(currentNote % scale.length)]));
    note.start();
    ++currentNote
    console.log((factor * scale.length + 1), (currentNote % scale.length), (factor * (scale.length + 1)) + (currentNote % scale.length));
    if( currentNote <= end ) {
      setTimeout(function() { playNext(note); }, noteTime);
    }
    else {
      setTimeout(function() { note.stop(); }, noteTime);
    }

    
  }
  playNext();
}


var chords = function() { setInterval(function() { 
if( chord ) { 
chord.stop(); 
}
i % 2 == 0 ? chord = majorChord(0): chord = minorChord(-3); 
chord.start();
++i;
}, 2000);
}

var melody = function() { setInterval(function() { playOsc(Math.random() * 200 + 200, 250, 0.4); }, 250) };

var i = 0;
var chord;
var drums = function() {
    setInterval(snare, 1000); var b = setInterval(function() { playRamp(instrumentStorage.kick, 300, 0.3); }, 500);
};


