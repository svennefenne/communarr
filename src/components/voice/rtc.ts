/** What the calls' and streams' connections share: how video is sent, and whether a connection goes through a TURN server. */

/** A video's sending: at most this tall, this many frames a second, this many bits a second. */
export type Quality = { height: number; fps: number; bitrate: number };

/** Does the connection go through a TURN server (either end's way in is a relay)? */
export async function relayed(pc: RTCPeerConnection): Promise<boolean> {
  const stats = await pc.getStats().catch(() => null);
  if (!stats) return false;
  type Pair = { localCandidateId?: string; remoteCandidateId?: string };
  let pair: Pair | undefined;
  stats.forEach((s: { type: string; selectedCandidatePairId?: string }) => {
    if (s.type === "transport" && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId);
  });
  if (!pair)
    stats.forEach((s: Pair & { type: string; nominated?: boolean; state?: string }) => {
      if (!pair && s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s;
    });
  if (!pair) return false;
  return [pair.localCandidateId, pair.remoteCandidateId].some((id) => (id ? stats.get(id)?.candidateType === "relay" : false));
}

/** A video sender's encoding: its bitrate, frames a second and size (scaled down from what's captured). */
export async function encodeAs(sender: RTCRtpSender | undefined, q: Quality) {
  if (!sender?.track) return;
  const p = sender.getParameters();
  if (!p.encodings?.length) return;
  const h = sender.track.getSettings().height ?? q.height;
  p.encodings[0] = { ...p.encodings[0], maxBitrate: q.bitrate, maxFramerate: q.fps, scaleResolutionDownBy: Math.max(1, h / q.height) };
  await sender.setParameters(p).catch(() => {});
}
