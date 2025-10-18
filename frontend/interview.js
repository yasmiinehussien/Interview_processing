const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const questionEl = document.getElementById('question');
const status = document.getElementById('status');

const BACKEND = 'http://127.0.0.1:5000';
let mediaRecorder, recordedChunks = [], localStream;

// Load question
questionEl.textContent = "What is the difference between Python tuples and sets?";

// Start recording
startBtn.onclick = async () => {
  startBtn.disabled = true;
  status.textContent = 'Requesting camera & mic...';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    preview.srcObject = localStream;
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    mediaRecorder.ondataavailable = e => { if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.start();
    stopBtn.disabled = false;
    status.textContent = 'Recording...';
  } catch {
    alert('Camera/microphone permission required.');
    startBtn.disabled = false;
    status.textContent = '';
  }
};

// Stop recording & upload
stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  stopBtn.disabled = true;
  startBtn.disabled = false;
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  status.textContent = 'Stopped. Uploading...';

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const fd = new FormData();
    fd.append('video', blob, 'answer.webm');
    fd.append('ideal_answer', 
      'Tuples are ordered and immutable collections, while sets are unordered collections of unique elements. Tuples allow duplicates and are indexed, sets do not'
    );
    fd.append('question', questionEl.textContent);


    // Animated loading dots
    let dots = 0;
    const loadingInterval = setInterval(() => {
      status.textContent = 'Uploading and analyzing' + '.'.repeat(dots);
      dots = (dots + 1) % 4;
    }, 500);

try {
  const res = await fetch(`${BACKEND}/upload`, { method: 'POST', body: fd });
  clearInterval(loadingInterval);
  const data = await res.json();

  if (data.error) {
    status.innerHTML = `<b>Error:</b> ${data.error}`;
  } else {
    status.innerHTML = `
      <b>Raw Transcript:</b><br>${data.raw_transcript}<br><br>
      <b>Polished Transcript:</b><br>${data.polished_transcript}<br><br>
      <b>Similarity:</b> ${(data.similarity * 100).toFixed(2)}%
    `;
  }
} catch (e) {
  clearInterval(loadingInterval);
  console.error(e);
  status.textContent = 'Upload failed';
}

  };
};
