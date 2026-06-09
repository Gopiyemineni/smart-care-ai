class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // smaller buffer = lower latency
    this.buffer = new Float32Array(this.bufferSize);
    this.head = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.head++] = channelData[i];
        if (this.head >= this.bufferSize) {
          const pcm16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          this.port.postMessage(pcm16);
          this.head = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("audio-recorder-worklet", AudioRecorderWorklet);

class AudioPlaybackWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.readIndex = 0;
    this.port.onmessage = (e) => {
      if (e.data === "clear") {
        this.buffer = [];
        this.readIndex = 0;
      } else {
        this.buffer.push(...e.data);
      }
    };
  }

  process(inputs, outputs) {
    const ch = outputs[0][0];
    const len = this.buffer.length;
    let idx = this.readIndex;
    
    for (let i = 0; i < ch.length; i++) {
      if (idx < len) {
        ch[i] = this.buffer[idx++];
      } else {
        ch[i] = 0;
      }
    }
    
    this.readIndex = idx;
    
    if (this.readIndex >= len && len > 0) {
      this.buffer = [];
      this.readIndex = 0;
    }
    
    return true;
  }
}
registerProcessor("audio-playback-worklet", AudioPlaybackWorklet);
