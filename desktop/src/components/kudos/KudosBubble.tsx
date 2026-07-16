import type { JSX } from "react";
import { ThemedText } from "@/components/ThemedText";
import { isMediaUrl } from "@/lib/kudos";

// One kudos: sender avatar + name, then either the text or the image/GIF it carries.
export function KudosBubble({
  name,
  icon,
  message,
}: {
  name: string;
  icon?: string;
  message: string;
}): JSX.Element {
  const media = isMediaUrl(message);
  return (
    <div className="flex items-start gap-2.5">
      {icon ? (
        <img src={icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <ThemedText type="defaultSemiBold" className="text-sm">
          {name}
        </ThemedText>
        {media ? (
          <img src={message} alt="" className="mt-1 max-h-56 rounded-xl object-cover" />
        ) : (
          <ThemedText type="lightBody" className="break-words text-muted-foreground">
            {message}
          </ThemedText>
        )}
      </div>
    </div>
  );
}

export default KudosBubble;
