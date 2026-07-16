import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "./context-menu";

describe("ContextMenu", () => {
  it("opens on right-click and shows items", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>
          <div data-testid="target">right click me</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Open</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(screen.queryByText("Open")).toBeNull();
    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(await screen.findByText("Open")).toBeTruthy();
  });
});
