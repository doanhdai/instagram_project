import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import Peer from "simple-peer";

// Sử dụng STOMP thay vì Socket.IO
// Endpoint backend đã được consolidate sang Spring STOMP (port 8081, /ws)
let socketInstance = null;

export function useWebSocket() {
  const currentUser = useSelector((state) => state.login?.userInfo);
  const socketRef = useRef();
  const [me, setMe] = useState("");
  const [caller, setCaller] = useState("");
  const [name, setName] = useState("");
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [callerSignal, setCallerSignal] = useState(null);
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [followNotifications, setFollowNotifications] = useState(null);
  const [peer, setPeer] = useState(null);
  const [stompClient, setStompClient] = useState(null);

  useEffect(() => {
    // Tạo STOMP connection thay vì Socket.IO
    // Dùng SockJS cho transport (tương thích STOMP endpoint /ws)
    if (!socketInstance && currentUser?.id) {
      const socketUrl = process.env.REACT_APP_API_URL || "http://localhost:8081";
      console.log("Creating STOMP WebSocket connection:", socketUrl, "userId:", currentUser.id);

      const stompClientInstance = Stomp.over(new SockJS(`${socketUrl}/ws`));
      stompClientInstance.debug = () => {};

      stompClientInstance.connect(
        { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
        (frame) => {
          console.log("STOMP connected successfully:", frame);
          socketInstance = stompClientInstance;
          setStompClient(stompClientInstance);
          stompClientInstance.subscribe(`/topic/notifications.${currentUser.id}`, (message) => {
            console.log("STOMP notification:", message.body);
            try {
              const data = JSON.parse(message.body);
              console.log("Parsed STOMP notification:", data);
            } catch (e) {
              console.error("Error parsing STOMP notification:", e);
            }
          });
          stompClientInstance.subscribe(`/topic/video-call.${currentUser.id}`, (message) => {
            console.log("STOMP video call signal:", message.body);
            try {
              const signal = JSON.parse(message.body);
              console.log("Parsed video call signal:", signal);
            } catch (e) {
              console.error("Error parsing video call signal:", e);
            }
          });
        },
        (error) => {
          console.error("STOMP connection error:", error);
        }
      );


    }

    socketRef.current = socketInstance || stompClient;

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (peer) {
        peer.destroy();
      }
      if (stompClient) {
        try {
          stompClient.disconnect();
          console.log("STOMP WebSocket disconnected");
        } catch (e) {
          console.warn("Error disconnecting STOMP:", e);
        }
      }
      socketInstance = null;
    };
  }, [currentUser]);

  const setupMediaStream = async () => {
    try {
      console.log("Setting up media stream...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Media stream obtained:", mediaStream.id);
      setStream(mediaStream);
      return mediaStream;
    } catch (error) {
      console.error("Error setting up media stream:", error);
      throw error;
    }
  };

  const callUser = async (userToCall) => {
    try {
      console.log("Initiating STOMP video call to:", userToCall);
      const mediaStream = await setupMediaStream();

      // Gửi signaling qua STOMP thay vì Socket.IO emit
      const signalData = {
        from: currentUser.id,
        name: currentUser.userFullname,
        to: userToCall,
        signal: {
          type: "offer",
          sdp: "STOMP video signaling placeholder - replace with actual WebRTC offer",
        },
      };

      if (stompClient && stompClient.connected) {
        stompClient.send(
          `/app/video-call/${userToCall}`,
          { "content-type": "application/json" },
          JSON.stringify(signalData)
        );
        console.log("Video call signal sent via STOMP:", signalData);
      } else {
        console.warn("STOMP not connected - video call signal queued");
      }

      const newPeer = new Peer({
        initiator: true,
        trickle: false,
        stream: mediaStream,
      });

      newPeer.on("signal", (data) => {
        console.log("Peer signaling (offer/answer) for STOMP video call:", data);
      });

      newPeer.on("stream", (remoteMediaStream) => {
        console.log("Received remote stream in caller");
        setRemoteStream(remoteMediaStream);
      });

      setPeer(newPeer);
    } catch (error) {
      console.error("Error in callUser:", error);
    }
  };

  const answerCall = async () => {
    try {
      console.log("Answering STOMP video call from:", caller);
      const mediaStream = await setupMediaStream();

      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
      });

      newPeer.on("signal", (data) => {
        console.log("Answer signal for video call:", data);
        // Gửi signal response qua STOMP
        if (stompClient && stompClient.connected) {
          stompClient.send(
            `/app/video-call/${caller}`,
            { "content-type": "application/json" },
            JSON.stringify({
              from: currentUser.id,
              to: caller,
              signal: { type: "answer", sdp: "STOMP answer placeholder" },
            })
          );
        }
      });

      newPeer.on("stream", (remoteMediaStream) => {
        console.log("Received remote stream in answerer");
        setRemoteStream(remoteMediaStream);
      });

      setCallAccepted(true);
      setIsVideoCallActive(true);
      setPeer(newPeer);
    } catch (error) {
      console.error("Error in answerCall:", error);
    }
  };

  const leaveCall = () => {
    try {
      if (stompClient && stompClient.connected) {
        stompClient.send(
          `/app/video-call/${caller}`,
          { "content-type": "application/json" },
          JSON.stringify({ action: "endCall", from: currentUser.id, to: caller })
        );
      }

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          stream.removeTrack(track);
        });
        setStream(null);
      }

      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => {
          track.stop();
          remoteStream.removeTrack(track);
        });
        setRemoteStream(null);
      }

      if (peer) {
        peer.destroy();
        setPeer(null);
      }

      setIsVideoCallActive(false);
      setCallAccepted(false);
      setReceivingCall(false);
      setCaller("");
      setCallerSignal(null);
    } catch (error) {
      console.error("Error in leaveCall:", error);
    }
  };

  const sendFollowNotification = ({ toUserId }) => {
    if (stompClient && stompClient.connected) {
      const payload = {
        fromUserId: String(currentUser.id),
        fromUserName: currentUser.userFullname || currentUser.name || "Unknown",
        toUserId: String(toUserId),
        message: `${currentUser.userFullname || currentUser.name || "Unknown"} vừa theo dõi bạn.`,
        sentAt: new Date().toISOString(),
      };
      stompClient.send(
        `/app/notifications/${toUserId}`,
        { "content-type": "application/json" },
        JSON.stringify(payload)
      );
      console.log("STOMP follow notification sent:", payload);
    } else {
      console.warn("STOMP not connected for follow notification");
    }
  };

  return {
    me,
    caller,
    name,
    callerSignal,
    receivingCall,
    callAccepted,
    isVideoCallActive,
    stream,
    remoteStream,
    socketRef,
    callUser,
    answerCall,
    leaveCall,
    sendFollowNotification,
    followNotifications,
  };
}
