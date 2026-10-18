/**
 * Utility for in-browser microphone voice recording and 16-bit PCM WAV encoding.
 * 100% compatible with ImageKit free tier and HTML5 <audio> players across all browsers.
 */

export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // 16-bit linear PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  isDefault?: boolean;
}

export async function getAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${idx + 1}`,
        isDefault: d.deviceId === "default",
      }));
  } catch {
    return [];
  }
}

export interface VoiceRecordingResult {
  blob: Blob;
  file: File;
  duration: number;
  maxAmplitude: number;
}

export class VoiceRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muteGainNode: GainNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private animFrameId: number | null = null;
  private startTime = 0;
  private isRecording = false;
  private currentLevel = 0;
  public activeDeviceLabel = "";

  public async start(options?: {
    deviceId?: string;
    onLevelChange?: (level: number) => void;
  }): Promise<string> {
    if (typeof window === "undefined") return "";

    // Clean any prior session
    this.cancel();

    let targetDeviceId = options?.deviceId;

    // If no specific device is requested, probe available devices to prefer real physical mic over virtual DroidCam
    if (!targetDeviceId && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === "audioinput");
        // Prefer Realtek, Array, Built-in, or non-virtual mic
        const preferred = audioInputs.find(
          (d) =>
            /realtek|array|built-in|internal/i.test(d.label) &&
            !/droidcam|virtual/i.test(d.label)
        );
        if (preferred && preferred.deviceId) {
          targetDeviceId = preferred.deviceId;
        }
      } catch {
        // Fall back to default
      }
    }

    const audioConstraints: MediaTrackConstraints = targetDeviceId
      ? {
          deviceId: { exact: targetDeviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        }
      : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch {
      // Fallback without exact deviceId if exact matching is unsupported
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    this.mediaStream = stream;

    // Read active track label
    const audioTrack = stream.getAudioTracks()[0];
    this.activeDeviceLabel = audioTrack?.label || "Default Microphone";

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    this.audioContext = audioCtx;

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(stream);
    this.sourceNode = source;

    // Setup Analyser for real-time visual level meter
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);
    this.analyserNode = analyser;

    // Buffer PCM samples using ScriptProcessorNode (4096 buffer size)
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    this.processorNode = processor;
    this.pcmChunks = [];
    this.currentLevel = 0;

    processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(input));

      // Calculate instant RMS level directly from incoming raw PCM samples
      let sumSquares = 0;
      for (let i = 0; i < input.length; i++) {
        sumSquares += input[i] * input[i];
      }
      const rms = Math.sqrt(sumSquares / input.length);
      // Voice RMS response curve: normal speech typically 0.02 - 0.2
      this.currentLevel = Math.min(1, Math.max(0, rms * 5.5));
    };

    source.connect(processor);

    // Mute gain prevents speaker feedback loop while recording
    const muteGain = audioCtx.createGain();
    muteGain.gain.value = 0;
    processor.connect(muteGain);
    analyser.connect(muteGain);
    muteGain.connect(audioCtx.destination);
    this.muteGainNode = muteGain;

    this.isRecording = true;
    this.startTime = Date.now();

    // Real-time audio level monitoring using Time Domain RMS + PCM smoothing
    if (options?.onLevelChange) {
      const timeData = new Uint8Array(analyser.fftSize);
      let smoothed = 0;

      const updateLevel = () => {
        if (!this.isRecording) return;

        analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const timeRms = Math.sqrt(sumSquares / timeData.length);
        const instantLevel = Math.max(this.currentLevel, Math.min(1, timeRms * 5.0));

        // Smooth decaying level meter
        if (instantLevel > smoothed) {
          smoothed = instantLevel;
        } else {
          smoothed = Math.max(0, smoothed * 0.88);
        }

        options.onLevelChange!(smoothed);
        this.animFrameId = requestAnimationFrame(updateLevel);
      };

      this.animFrameId = requestAnimationFrame(updateLevel);
    }

    return this.activeDeviceLabel;
  }

  public async stop(): Promise<VoiceRecordingResult> {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    // Release microphone tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Disconnect audio graph
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.muteGainNode) {
      this.muteGainNode.disconnect();
      this.muteGainNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    const inputSampleRate = this.audioContext?.sampleRate || 44100;
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    // Merge PCM buffers
    const totalSamples = this.pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    let maxAmp = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
      for (let i = 0; i < chunk.length; i++) {
        const abs = Math.abs(chunk[i]);
        if (abs > maxAmp) maxAmp = abs;
      }
    }
    this.pcmChunks = [];

    // Downsample to 16,000 Hz for voice (standard wideband voice, crystal clear, low bandwidth)
    const targetSampleRate = 16000;
    const downsampled = downsampleBuffer(merged, inputSampleRate, targetSampleRate);

    // Encode standard 16-bit mono PCM WAV
    const wavBuffer = encodeWAV(downsampled, targetSampleRate);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const filename = `voice_note_${Date.now()}.wav`;
    const file = new File([blob], filename, { type: "audio/wav" });

    return {
      blob,
      file,
      duration: durationSec,
      maxAmplitude: maxAmp,
    };
  }

  public cancel(): void {
    this.isRecording = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.muteGainNode) {
      this.muteGainNode.disconnect();
      this.muteGainNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.pcmChunks = [];
  }
}
