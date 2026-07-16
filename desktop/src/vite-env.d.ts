/// <reference types="vite/client" />

import type * as React from "react";

// <emoji-picker> is a custom element from emoji-picker-element. React 19 resolves
// intrinsic tags through React.JSX, so the augmentation must live there.
type EmojiPickerElementProps = {
  ref?: React.Ref<HTMLElement>;
  class?: string;
  style?: React.CSSProperties;
  "data-skin-tone-position"?: string;
  children?: React.ReactNode;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "emoji-picker": EmojiPickerElementProps;
    }
  }
}
