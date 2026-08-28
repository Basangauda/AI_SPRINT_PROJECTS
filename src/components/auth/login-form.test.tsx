import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
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

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
  });

  it("renders username and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("redirects to /mcq after a successful login", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: sampleUser }),
    });

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/username or email/i), "jsmith");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/mcq");
      expect(JSON.parse(sessionStorage.getItem(AUTH_USER_KEY)!)).toEqual(
        sampleUser
      );
    });
  });

  it("shows a generic error message on 401 responses", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid username or password" }),
    });

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/username or email/i), "jsmith");
    await user.type(screen.getByLabelText(/^password$/i), "WrongPassword");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText("Invalid username or password")
    ).toBeInTheDocument();
  });
});
