import { useEffect, useRef, useState } from "react";
import { createWebSocketUrl } from "../services/api";

export interface RoomParticipant {
  id: string;
  name: string;
}

export interface MeetingChatMessage {
  id: string;
  participantId: string;
  name: string;
  text: string;
  sentAt: string;
}

type RoomSignal = { kind: "description"; description: RTCSessionDescriptionInit } | { kind: "candidate"; candidate: RTCIceCandidateInit };

export function useVideoMeeting(roomId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const candidateQueue = useRef(new Map<string, RTCIceCandidateInit[]>());
  const participantIdRef = useRef("");
  const intentionalClose = useRef(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [participantId, setParticipantId] = useState("");
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  useEffect(() => () => {
    intentionalClose.current = true;
    socketRef.current?.close();
    for (const connection of peersRef.current.values()) connection.close();
    peersRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function send(payload: Record<string, unknown>) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  async function createPeer(peer: RoomParticipant, initiateOffer: boolean): Promise<RTCPeerConnection> {
    const current = peersRef.current.get(peer.id);
    if (current) return current;

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peersRef.current.set(peer.id, connection);
    for (const track of streamRef.current?.getTracks() ?? []) connection.addTrack(track, streamRef.current!);
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams((currentStreams) => ({ ...currentStreams, [peer.id]: stream }));
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: "signal", target_id: peer.id, signal: { kind: "candidate", candidate: event.candidate.toJSON() } });
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") setError(`Media connection to ${peer.name} failed. Check network access and camera/microphone permissions.`);
    };

    if (initiateOffer) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      send({ type: "signal", target_id: peer.id, signal: { kind: "description", description: connection.localDescription?.toJSON() } });
    }
    return connection;
  }

  async function handleMessage(message: any) {
    if (message.type === "joined") {
      const self = message.participant as RoomParticipant;
      participantIdRef.current = self.id;
      setParticipantId(self.id);
      const otherParticipants = (message.participants ?? []) as RoomParticipant[];
      setParticipants([self, ...otherParticipants]);
      await Promise.all(otherParticipants.map((peer) => createPeer(peer, true)));
    } else if (message.type === "participant-joined") {
      const joined = message.participant as RoomParticipant;
      setParticipants((current) => current.some((person) => person.id === joined.id) ? current : [...current, joined]);
    } else if (message.type === "participant-left") {
      const leftId = String(message.participant_id);
      peersRef.current.get(leftId)?.close();
      peersRef.current.delete(leftId);
      candidateQueue.current.delete(leftId);
      setParticipants((current) => current.filter((person) => person.id !== leftId));
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[leftId];
        return next;
      });
    } else if (message.type === "signal") {
      const peer = message.participant as RoomParticipant;
      const signal = message.signal as RoomSignal;
      const connection = await createPeer(peer, false);
      if (signal.kind === "description") {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.description));
        const waiting = candidateQueue.current.get(peer.id) ?? [];
        candidateQueue.current.delete(peer.id);
        for (const candidate of waiting) await connection.addIceCandidate(new RTCIceCandidate(candidate));
        if (signal.description.type === "offer") {
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          send({ type: "signal", target_id: peer.id, signal: { kind: "description", description: connection.localDescription?.toJSON() } });
        }
      } else if (signal.kind === "candidate") {
        if (connection.remoteDescription) await connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        else candidateQueue.current.set(peer.id, [...(candidateQueue.current.get(peer.id) ?? []), signal.candidate]);
      }
    } else if (message.type === "chat") {
      setChatMessages((current) => [...current, {
        id: crypto.randomUUID(),
        participantId: message.participant.id,
        name: message.participant.name,
        text: String(message.text),
        sentAt: new Date().toISOString(),
      }]);
    } else if (message.type === "error") {
      setError(String(message.message ?? "Meeting signaling failed."));
    }
  }

  async function join(displayName: string, publishMedia = true): Promise<boolean> {
    if (socketRef.current) return true;
    setError(null);
    setStatus("connecting");
    intentionalClose.current = false;
    try {
      if (publishMedia) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera and microphone access requires HTTPS (or localhost) and browser support.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        setLocalStream(stream);
      }
      const socket = new WebSocket(createWebSocketUrl(`/api/rooms/${encodeURIComponent(roomId)}/signal`, { display_name: displayName.trim().slice(0, 60) || "Guest" }));
      socketRef.current = socket;
      socket.onopen = () => setStatus("connected");
      socket.onmessage = (event) => {
        try {
          void handleMessage(JSON.parse(String(event.data))).catch((reason: Error) => setError(reason.message));
        } catch {
          setError("Received an invalid signaling message.");
        }
      };
      socket.onerror = () => {
        if (intentionalClose.current) return;
        setError("Could not reach the meeting signaling service.");
        setStatus("error");
      };
      socket.onclose = () => {
        socketRef.current = null;
        if (!intentionalClose.current) setStatus("disconnected");
      };
      return true;
    } catch (reason) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      setError(reason instanceof Error ? reason.message : "Could not access meeting media.");
      setStatus("error");
      return false;
    }
  }

  function sendChat(text: string) {
    if (text.trim()) send({ type: "chat", text: text.trim().slice(0, 2000) });
  }

  function setTrackEnabled(kind: "audio" | "video", enabled: boolean) {
    for (const track of streamRef.current?.getTracks() ?? []) {
      if (track.kind === kind) track.enabled = enabled;
    }
  }

  async function toggleScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing is not available in this browser or origin.");
      return;
    }
    try {
      if (isSharingScreen) {
        const cameraTrack = streamRef.current?.getVideoTracks()[0] ?? null;
        await replaceVideoTrack(cameraTrack);
        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setIsSharingScreen(false);
        return;
      }
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = display;
      const screenTrack = display.getVideoTracks()[0];
      await replaceVideoTrack(screenTrack);
      screenTrack.onended = () => {
        void replaceVideoTrack(streamRef.current?.getVideoTracks()[0] ?? null);
        screenStreamRef.current = null;
        setIsSharingScreen(false);
      };
      setIsSharingScreen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Screen sharing was cancelled or unavailable.");
    }
  }

  async function replaceVideoTrack(track: MediaStreamTrack | null) {
    for (const connection of peersRef.current.values()) {
      const sender = connection.getSenders().find((item) => item.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
      else if (track && streamRef.current) connection.addTrack(track, streamRef.current);
    }
  }

  function leave() {
    intentionalClose.current = true;
    socketRef.current?.close();
    socketRef.current = null;
    for (const connection of peersRef.current.values()) connection.close();
    peersRef.current.clear();
    candidateQueue.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    screenStreamRef.current = null;
    participantIdRef.current = "";
    setParticipantId("");
    setLocalStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setChatMessages([]);
    setIsSharingScreen(false);
    setStatus("disconnected");
  }

  return {
    status, participantId, participants, localStream, remoteStreams, chatMessages, error, isSharingScreen,
    join, leave, sendChat, setTrackEnabled, toggleScreenShare,
  };
}