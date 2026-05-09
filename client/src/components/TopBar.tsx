type User = { _id: string; name: string; color: string };

type Props = {
  roomName: string;
  users: User[];
  selfUserId?: string | null;
};

export default function TopBar({ roomName, users, selfUserId }: Props) {
  return (
    <div className="flex h-full items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-base font-bold tracking-tight">rts-agent</span>
        <span className="text-stone-500">·</span>
        <span className="text-sm text-stone-300">
          Room: <span className="font-medium text-stone-100">{roomName}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-500">
          {users.length === 0
            ? "no devs online"
            : `${users.length} dev${users.length === 1 ? "" : "s"} online`}
        </span>
        <div className="flex -space-x-2">
          {users.slice(0, 6).map((u) => (
            <div
              key={u._id}
              title={u.name + (u._id === selfUserId ? " (you)" : "")}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-900 text-[10px] font-bold uppercase text-stone-950"
              style={{ backgroundColor: u.color }}
            >
              {u.name.slice(0, 2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
