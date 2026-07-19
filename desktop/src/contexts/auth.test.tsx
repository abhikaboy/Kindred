import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth";

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={logout}>Log out</button>;
}

describe("auth logout", () => {
  it("clears the query cache so the next account doesn't see stale data", () => {
    const qc = new QueryClient();
    qc.setQueryData(["get", "/v1/user/workspaces"], [{ id: "old-account" }]);

    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <LogoutButton />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(qc.getQueryData(["get", "/v1/user/workspaces"])).toBeTruthy();
    fireEvent.click(screen.getByText("Log out"));
    expect(qc.getQueryData(["get", "/v1/user/workspaces"])).toBeUndefined();
  });
});
