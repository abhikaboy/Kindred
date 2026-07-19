import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { isMediaUrl } from "@/lib/kudos";
import { X } from "@phosphor-icons/react";

// One kudos: sender avatar + name, then either the text or the image/GIF it carries.
export function KudosBubble({
  name,
  icon,
  message,
  senderId,
}: {
  name: string;
  icon?: string;
  message: string;
  senderId?: string;
}): JSX.Element {
  const [showPreview, setShowPreview] = useState(false);
  const media = isMediaUrl(message);

  const avatar = icon ? (
    <img src={icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted object-cover" />
  ) : null;

  return (
    <>
      <div className="flex items-start gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => media && setShowPreview(true)}>
        {senderId && avatar ? (
          <Link to={`/account/${senderId}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
            {avatar}
          </Link>
        ) : (
          avatar
        )}
        <div className="min-w-0 flex-1">
          {senderId ? (
            <Link to={`/account/${senderId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
              <ThemedText type="defaultSemiBold" className="text-sm">
                {name}
              </ThemedText>
            </Link>
          ) : (
            <ThemedText type="defaultSemiBold" className="text-sm">
              {name}
            </ThemedText>
          )}
          {media ? (
            <img src={message} alt="" className="mt-1 max-h-56 rounded-xl object-cover" />
          ) : (
            <ThemedText type="lightBody" className="break-words text-muted-foreground text-sm">
              {message}
            </ThemedText>
          )}
        </div>
      </div>

      {/* Preview modal for images */}
      {showPreview && media && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPreview(false)}>
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={message} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default KudosBubble;
