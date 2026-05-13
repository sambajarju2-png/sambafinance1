"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { PhoneOff, Loader2 } from "lucide-react";

interface CoachCallRoomProps {
  roomName: string;
  token: string;
  livekitUrl: string;
  coachName?: string;
  onLeave: () => void;
}

export default function CoachCallRoom({ roomName, token, livekitUrl, coachName, onLeave }: CoachCallRoomProps) {
  const [connected, setConnected] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-pw-navy flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Verbonden
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verbinden...
            </span>
          )}
          {coachName && (
            <span className="text-sm text-white/40 ml-1">· {coachName}</span>
          )}
        </div>

        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium active:scale-95"
        >
          <PhoneOff className="w-4 h-4" />
          Ophangen
        </button>
      </div>

      {/* LiveKit room */}
      <div className="flex-1 overflow-hidden">
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          audio={true}
          video={true}
          onConnected={() => setConnected(true)}
          onDisconnected={onLeave}
          data-lk-theme="default"
          style={{ height: "100%" }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>

      {/* Privacy footer */}
      <div
        className="px-5 py-2 text-center text-[11px] text-white/20 flex-shrink-0"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        🔒 Privé gesprek · Geen opname · Versleuteld
      </div>
    </div>
  );
}
