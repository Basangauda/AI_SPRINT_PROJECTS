import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqStub } from "./mcq-stub";
import { AUTH_USER_KEY } from "@/lib/auth-session";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const fetchMock = vi.fn();

const sampleUser = {
  id: "user-1",
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
};

describe("McqStub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(sampleUser));
  });

  it("displays the stub heading and user info from sessionStorage", () => {
    render(<McqStub />);

    expect(screen.getByText("MCQ Test Bank")).toBeInTheDocument();
    expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    expect(screen.getByText(/jsmith/i)).toBeInTheDocument();
    expect(screen.getByText(/science/i)).toBeInTheDocument();
  });

  it("logs out, clears sessionStorage, and navigates to /login", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: "Logged out successfully" }),
    });

    render(<McqStub />);
    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      });
      expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
      expect(push).toHaveBeenCalledWith("/login");
    });
  });
});
