import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { patchChatSession } from "../chat-session";
import { ChatMascot } from "./chat-mascot";

export function ChatNewButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const { userId } = useAuth();
  const client = useQueryClient();
  return (
    <Button
      variant={iconOnly ? "ghost" : "secondary"}
      asChild
      className={
        iconOnly
          ? "size-9 shrink-0 rounded-full p-0 text-muted-foreground"
          : "h-12 min-w-0 flex-1 gap-2 rounded-full shadow-sm [&_svg]:size-full"
      }
    >
      <Link
        to="/chat"
        title="Chat baru"
        aria-label="Chat baru"
        onClick={() =>
          patchChatSession(client, ["chat", userId], "new:standalone", {
            draft: "",
            excerpts: [],
            pageContext: undefined,
          })
        }
      >
        {iconOnly ? (
          <Plus className="size-5" />
        ) : (
          <>
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center">
              <ChatMascot className="size-full" />
            </span>
            <span>New chat</span>
          </>
        )}
      </Link>
    </Button>
  );
}
