import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Peer from "simple-peer";
import webSocketService from "../../Service/WebSocketService";

/**
 * Hook video call dùng chung STOMP client với Messenger/Notification.
 * Trước đây hook này tự mở thêm 1 SockJS connection và subscribe topic công
 * khai; giờ chỉ đăng ký listener trên user queue.
 */
export function useWebSocket() {
  const currentUser = useSelector((state) => state.login?.userInfo);
  const accessToken = useSelector((state) => state.login?.accessToken);

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
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);

  const streamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  const stopStream = useCallback((mediaStream) => {
    if (!mediaStream) {
      return;
    }
    mediaStream.getTracks().forEach((track) => track.stop());
  }, []);

  const cleanupMedia = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);

    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;
    setRemoteStream(null);

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      setPeer(null);
    }

    setIsVideoCallActive(false);
    setCallAccepted(false);
    setReceivingCall(false);
    setCaller("");
    setCallerSignal(null);
    remoteUserIdRef.current = null;
  }, [stopStream]);

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined;
    }

    let active = true;
    webSocketService.init(undefined, currentUser.id, accessToken);
    webSocketService.connect().catch((error) => {
      if (active) {
        console.error("Cannot connect WebSocket for video call:", error);
      }
    });

    const unsubscribeVideo = webSocketService.on("video-call", (signal) => {
      if (!active || !signal) {
        return;
      }
      if (signal.action === "endCall") {
        cleanupMedia();
        return;
      }
      if (signal.signal?.type === "offer") {
        remoteUserIdRef.current = signal.from;
        setReceivingCall(true);
        setCaller(signal.from);
        setName(signal.name || "");
        setCallerSignal(signal.signal);
      } else if (signal.signal?.type === "answer") {
        setCallerSignal(signal.signal);
        if (peerRef.current) {
          try {
            peerRef.current.signal(signal.signal);
          } catch (error) {
            console.warn("Cannot apply video answer:", error);
          }
        }
      }
    });

    const unsubscribeNotification = webSocketService.on(
      "notification",
      (notification) => setFollowNotifications(notification)
    );

    return () => {
      active = false;
      unsubscribeVideo();
      unsubscribeNotification();
    };
  }, [currentUser?.id, accessToken, cleanupMedia]);

  const setupMediaStream = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    streamRef.current = mediaStream;
    setStream(mediaStream);
    return mediaStream;
  }, []);

  const callUser = useCallback(
    async (userToCall) => {
      if (!currentUser?.id || !userToCall) {
        return;
      }
      try {
        const mediaStream = await setupMediaStream();
        remoteUserIdRef.current = userToCall;
        const newPeer = new Peer({
          initiator: true,
          trickle: false,
          stream: mediaStream,
        });
        peerRef.current = newPeer;
        setPeer(newPeer);

        newPeer.on("signal", (data) => {
          webSocketService
            .sendVideoSignal(userToCall, {
              from: currentUser.id,
              name: currentUser.userFullname,
              signal: data,
            })
            .catch((error) =>
              console.error("Cannot send video offer:", error)
            );
        });

        newPeer.on("stream", (remoteMediaStream) => {
          remoteStreamRef.current = remoteMediaStream;
          setRemoteStream(remoteMediaStream);
        });

        setIsVideoCallActive(true);
      } catch (error) {
        console.error("Error in callUser:", error);
        cleanupMedia();
      }
    },
    [currentUser?.id, currentUser?.userFullname, setupMediaStream, cleanupMedia]
  );

  const answerCall = useCallback(async () => {
    if (!currentUser?.id || !caller) {
      return;
    }
    try {
      const mediaStream = await setupMediaStream();
      remoteUserIdRef.current = caller;
      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
      });
      peerRef.current = newPeer;
      setPeer(newPeer);

      newPeer.on("signal", (data) => {
        webSocketService
          .sendVideoSignal(caller, {
            from: currentUser.id,
            name: currentUser.userFullname,
            signal: data,
          })
          .catch((error) =>
            console.error("Cannot send video answer:", error)
          );
      });

      newPeer.on("stream", (remoteMediaStream) => {
        remoteStreamRef.current = remoteMediaStream;
        setRemoteStream(remoteMediaStream);
      });

      if (callerSignal) {
        newPeer.signal(callerSignal);
      }

      setCallAccepted(true);
      setIsVideoCallActive(true);
      setReceivingCall(false);
    } catch (error) {
      console.error("Error in answerCall:", error);
      cleanupMedia();
    }
  }, [
    currentUser?.id,
    currentUser?.userFullname,
    caller,
    callerSignal,
    setupMediaStream,
    cleanupMedia,
  ]);

  const leaveCall = useCallback(() => {
    const remoteUserId = remoteUserIdRef.current || caller;
    if (remoteUserId) {
      webSocketService
        .sendVideoSignal(remoteUserId, { action: "endCall" })
        .catch((error) => console.warn("Cannot send endCall:", error));
    }
    cleanupMedia();
  }, [caller, cleanupMedia]);

  const sendFollowNotification = useCallback(
    ({ toUserId }) => {
      if (!currentUser?.id || !toUserId) {
        return;
      }
      const displayName =
        currentUser.userFullname || currentUser.name || "Unknown";
      webSocketService
        .sendNotification(toUserId, {
          fromUserId: String(currentUser.id),
          fromUserName: displayName,
          toUserId: String(toUserId),
          message: `${displayName} vừa theo dõi bạn.`,
          sentAt: new Date().toISOString(),
        })
        .catch((error) =>
          console.warn("Cannot send follow notification:", error)
        );
    },
    [currentUser?.id, currentUser?.userFullname, currentUser?.name]
  );

  const listCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(
        devices.filter((device) => device.kind === "videoinput")
      );
    } catch (error) {
      console.warn("Cannot enumerate cameras:", error);
    }
  }, []);

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
    callUser,
    answerCall,
    leaveCall,
    sendFollowNotification,
    followNotifications,
    selectedCameraId,
    setSelectedCameraId,
    availableCameras,
    listCameras,
    peer,
    setMe,
  };
}
