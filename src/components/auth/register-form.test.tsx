import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./register-form";
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

const validForm = {
  firstName: "Jane",
  lastName: "Smith",
  username: "jsmith",
  email: "jane.smith@school.edu",
  group: "Science",
  password: "SecurePass123",
  confirmPassword: "SecurePass123",
};

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<typeof validForm> = {}
) {
  const data = { ...validForm, ...overrides };

  await user.type(screen.getByLabelText(/first name/i), data.firstName);
  await user.type(screen.getByLabelText(/last name/i), data.lastName);
  await user.type(screen.getByLabelText(/^username$/i), data.username);
  await user.type(screen.getByLabelText(/email/i), data.email);
  await user.type(screen.getByLabelText(/^group$/i), data.group);
  await user.type(screen.getByLabelText(/^password$/i), data.password);
  await user.type(screen.getByLabelText(/confirm password/i), data.confirmPassword);
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
  });

  it("renders all required fields", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^group$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("submits valid data to the register API", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ user: sampleUser }),
    });

    render(<RegisterForm />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: validForm.firstName,
          lastName: validForm.lastName,
          username: validForm.username,
          email: validForm.email,
          group: validForm.group,
          password: validForm.password,
        }),
      });
    });
  });

  it("redirects to /mcq and stores the user on success", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ user: sampleUser }),
    });

    render(<RegisterForm />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/mcq");
      expect(JSON.parse(sessionStorage.getItem(AUTH_USER_KEY)!)).toEqual(
        sampleUser
      );
    });
  });

  it("displays an error message on 409 responses", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Username already taken" }),
    });

    render(<RegisterForm />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText("Username already taken")
    ).toBeInTheDocument();
  });

  it("displays an error message on 400 responses", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Validation failed" }),
    });

    render(<RegisterForm />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
  });

  it("shows a client-side error when passwords do not match", async () => {
    const user = userEvent.setup();

    render(<RegisterForm />);
    await fillRegisterForm(user, { confirmPassword: "DifferentPass123" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
