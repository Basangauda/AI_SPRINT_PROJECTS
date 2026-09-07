import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqManagement } from "./mcq-management";
import { AUTH_USER_KEY } from "@/lib/auth-session";

const push = vi.fn();
const getAuthUserMock = vi.fn();
const clearAuthUserMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-session")>(
    "@/lib/auth-session"
  );

  return {
    ...actual,
    getAuthUser: () => getAuthUserMock(),
    clearAuthUser: () => clearAuthUserMock(),
  };
});

const fetchMock = vi.fn();

const sampleUser = {
  id: "user-1",
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
};

const sampleMcq = {
  id: "mcq-1",
  name: "Photosynthesis basics",
  question: "Which organelle carries out photosynthesis?",
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T10:00:00.000Z",
};

const sampleMcqDetail = {
  ...sampleMcq,
  choices: [
    { id: "choice-1", choice: "Mitochondria", isCorrect: false },
    { id: "choice-2", choice: "Chloroplast", isCorrect: true },
  ],
};

describe("McqManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(sampleUser));
    getAuthUserMock.mockReturnValue(sampleUser);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mcqs: [] }),
    });
  });

  it("loads and displays the MCQ table", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mcqs: [sampleMcq] }),
    });

    render(<McqManagement />);

    expect(await screen.findByText(sampleMcq.name)).toBeInTheDocument();
    expect(screen.getByText(sampleMcq.question)).toBeInTheDocument();
  });

  it("navigates to /mcq/new when Create Question is clicked", async () => {
    const user = userEvent.setup();

    render(<McqManagement />);

    await user.click(await screen.findByRole("button", { name: /create question/i }));

    expect(push).toHaveBeenCalledWith("/mcq/new");
  });

  it("navigates to /mcq/[id]/edit when Edit is selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mcqs: [sampleMcq] }),
    });

    render(<McqManagement />);
    await screen.findByText(sampleMcq.name);

    await user.click(
      screen.getByRole("button", { name: /actions for photosynthesis basics/i })
    );
    await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));

    expect(push).toHaveBeenCalledWith("/mcq/mcq-1/edit");
  });

  it("confirms delete and calls DELETE /api/mcq/[id]", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/mcq" && init?.method !== "DELETE") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ mcqs: [sampleMcq] }),
        };
      }

      if (url === "/api/mcq/mcq-1" && init?.method === "DELETE") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: "MCQ deleted successfully" }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ mcqs: [] }),
      };
    });

    render(<McqManagement />);
    await screen.findByText(sampleMcq.name);

    await user.click(
      screen.getByRole("button", { name: /actions for photosynthesis basics/i })
    );
    await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/mcq/mcq-1", {
        method: "DELETE",
      });
    });
  });

  it("opens preview, submits an attempt, and shows the result", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/mcq" && !init?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ mcqs: [sampleMcq] }),
        };
      }

      if (url === "/api/mcq/mcq-1" && !init?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ mcq: sampleMcqDetail }),
        };
      }

      if (url === "/api/mcq/mcq-1/attempts" && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            attempt: {
              id: "attempt-1",
              mcqId: "mcq-1",
              userId: "user-1",
              choiceId: "choice-2",
              isCorrect: true,
              createdAt: "2026-09-04T12:00:00.000Z",
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    render(<McqManagement />);
    await screen.findByText(sampleMcq.name);

    await user.click(
      screen.getByRole("button", { name: /actions for photosynthesis basics/i })
    );
    await user.click(await screen.findByRole("menuitem", { name: /^preview$/i }));
    await user.click(await screen.findByRole("radio", { name: /chloroplast/i }));
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/mcq/mcq-1/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          choiceId: "choice-2",
        }),
      });
      expect(screen.getByText(/correct!/i)).toBeInTheDocument();
    });
  });

  it("redirects to /login when no auth user is found", async () => {
    getAuthUserMock.mockReturnValue(null);
    sessionStorage.clear();

    render(<McqManagement />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  it("logs out, clears sessionStorage, and navigates to /login", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/logout") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: "Logged out successfully" }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ mcqs: [] }),
      };
    });

    render(<McqManagement />);
    await screen.findByText(/mcq test bank/i);

    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      });
      expect(clearAuthUserMock).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/login");
    });
  });
});
