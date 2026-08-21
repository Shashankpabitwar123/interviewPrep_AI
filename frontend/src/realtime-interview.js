function waitForIceGatheringComplete(peerConnection) {
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(finish, 2500);
    function finish() {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    function onChange() {
      if (peerConnection.iceGatheringState === "complete") finish();
    }
    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

export async function createRealtimeInterviewConnection({ apiFetch, interviewId, audioElement, onEvent, onState }) {
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    throw new Error("Live voice interviews require a current browser with microphone and WebRTC support.");
  }

  onState?.("requesting-microphone");
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const peerConnection = new RTCPeerConnection();
  localStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.addEventListener("track", (event) => {
    if (!audioElement) return;
    audioElement.srcObject = event.streams[0];
    audioElement.play().catch(() => undefined);
  });
  peerConnection.addEventListener("connectionstatechange", () => onState?.(peerConnection.connectionState));

  const dataChannel = peerConnection.createDataChannel("oai-events");
  dataChannel.addEventListener("message", (event) => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      // Ignore malformed diagnostic events while keeping the audio call alive.
    }
  });
  dataChannel.addEventListener("open", () => {
    onState?.("connected");
    dataChannel.send(JSON.stringify({
      type: "response.create",
      response: { instructions: "Begin the interview now with the welcome and planned question 1." },
    }));
  });

  onState?.("connecting");
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGatheringComplete(peerConnection);
  const response = await apiFetch(`/mock-interviews/${interviewId}/realtime-call`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: peerConnection.localDescription?.sdp || offer.sdp,
  });
  if (!response.ok) {
    let detail = `Live interview could not start (${response.status}).`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Keep the status-based message for non-JSON failures.
    }
    localStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
    throw new Error(detail);
  }
  await peerConnection.setRemoteDescription({ type: "answer", sdp: await response.text() });

  return {
    sendControl(text) {
      if (dataChannel.readyState !== "open") return false;
      dataChannel.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }));
      dataChannel.send(JSON.stringify({ type: "response.create" }));
      return true;
    },
    setMicEnabled(enabled) {
      localStream.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    },
    setAudioMuted(muted) {
      if (audioElement) audioElement.muted = muted;
    },
    close() {
      try { dataChannel.close(); } catch { /* already closed */ }
      localStream.getTracks().forEach((track) => track.stop());
      peerConnection.close();
      if (audioElement) audioElement.srcObject = null;
    },
  };
}
