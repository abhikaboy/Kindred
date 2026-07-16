import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskContextMenu } from "./TaskContextMenu";
import type { TaskDocument } from "@/hooks/useWorkspaces";

const task = { id: "t1", categoryID: "c1", content: "Test task" } as TaskDocument;

describe("TaskContextMenu", () => {
  it("opens the task menu on right-click", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TaskContextMenu task={task}>
            <div data-testid="card">card</div>
          </TaskContextMenu>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.queryByText("Delete")).toBeNull();
    fireEvent.contextMenu(screen.getByTestId("card"));
    expect(await screen.findByText("Delete")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });
});
