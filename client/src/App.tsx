import { ConvexReactClient } from "convex/react";
import ConnectedApp from "./ConnectedApp";
import DisconnectedApp from "./DisconnectedApp";

type Props = { convex: ConvexReactClient | null; roomName: string };

export default function App({ convex, roomName }: Props) {
  return convex ? <ConnectedApp roomName={roomName} /> : <DisconnectedApp />;
}
