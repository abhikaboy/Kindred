import React from "react";
import { Text } from "react-native";
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
    const tagIndex = React.useMemo(() => {
        const m = new Map<string, string>(); // handle (lowercased) -> id
        for (const t of taggedUsers) m.set(t.handle.toLowerCase(), t.id);
        return m;
    }, [taggedUsers]);

    // Split the caption into plain text + mention runs.
    // Regex: @ followed by handle chars (a-z 0-9 _ .).
    const parts: Array<{ type: "text" | "mention"; value: string; id?: string }> = [];
    const re = /@([a-zA-Z0-9_.]+)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(caption)) !== null) {
        const id = tagIndex.get(match[1].toLowerCase());
        if (match.index > last) {
            parts.push({ type: "text", value: caption.slice(last, match.index) });
        }
        if (id) {
            parts.push({ type: "mention", value: match[0], id });
        } else {
            parts.push({ type: "text", value: match[0] }); // raw @ without a matching tag → plain text
        }
        last = re.lastIndex;
    }
    if (last < caption.length) {
        parts.push({ type: "text", value: caption.slice(last) });
    }

    return (
        <ThemedText>
            {parts.map((p, i) =>
                p.type === "mention" ? (
                    <Text
                        key={i}
                        style={{ color: ThemedColor.primary }}
                        onPress={() => router.push(`/account/${p.id}` as Href)}>
                        {p.value}
                    </Text>
                ) : (
                    <Text key={i}>{p.value}</Text>
                ),
            )}
        </ThemedText>
    );
};

export default PostCardCaption;
