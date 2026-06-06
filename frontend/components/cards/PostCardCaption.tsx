import React from "react";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { Href } from "expo-router";

type Props = {
    caption: string;
    taggedUsers: Array<{ id: string; handle: string }>;
};

const PostCardCaption = ({ caption, taggedUsers }: Props) => {
    const ThemedColor = useThemeColor();
    // Handles may or may not carry a leading "@"; normalize both the index keys
    // and the captured run so the lookup matches regardless.
    const normalize = (h: string) => h.replace(/^@/, "").toLowerCase();
    const tagIndex = React.useMemo(() => {
        const m = new Map<string, string>();
        for (const t of taggedUsers) m.set(normalize(t.handle), t.id);
        return m;
    }, [taggedUsers]);

    const parts: Array<{ type: "text" | "mention"; value: string; id?: string }> = [];
    const re = /@([a-zA-Z0-9_.]+)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(caption)) !== null) {
        const id = tagIndex.get(normalize(match[1]));
        if (match.index > last) {
            parts.push({ type: "text", value: caption.slice(last, match.index) });
        }
        if (id) {
            parts.push({ type: "mention", value: match[0], id });
        } else {
            parts.push({ type: "text", value: match[0] });
        }
        last = re.lastIndex;
    }
    if (last < caption.length) {
        parts.push({ type: "text", value: caption.slice(last) });
    }

    return (
        <ThemedText type="default">
            {parts.map((p, i) =>
                p.type === "mention" ? (
                    <ThemedText
                        key={i}
                        type="defaultSemiBold"
                        style={{ color: ThemedColor.primary }}
                        onPress={() => router.push(`/account/${p.id}` as Href)}>
                        {p.value}
                    </ThemedText>
                ) : (
                    <ThemedText key={i} type="default">
                        {p.value}
                    </ThemedText>
                ),
            )}
        </ThemedText>
    );
};

export default PostCardCaption;
