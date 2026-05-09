import { ConvexReactClient } from "convex/react";
import ConnectedApp from "./ConnectedApp";
import DisconnectedApp from "./DisconnectedApp";

type Props = { convex: ConvexReactClient | null };

export default function App({ convex }: Props) {
  return convex ? <ConnectedApp /> : <DisconnectedApp />;
}
