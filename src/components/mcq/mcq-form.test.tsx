import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqForm } from "./mcq-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const fetchMock = vi.fn();

const sampleMcq = {
  id: "mcq-1",
  name: "Photosynthesis basics",
  question: "Which organelle carries out photosynthesis?",
  choices: [
    { id: "choice-1", choice: "Mitochondria", isCorrect: false },
    { id: "choice-2", choice: "Chloroplast", isCorrect: true },
  ],
  createdAt: "2026-09-04 10:00:00",
  updatedAt: "2026-09-04 10:00:00",
};

describe("McqForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders name, question, and two default choices in create mode", () => {
    render(<McqForm mode="create" />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/choice text/i)).toHaveLength(2);
  });

  it("tells the user the radio buttons select the correct answer", () => {
    render(<McqForm mode="create" />);

    expect(screen.getByText(/correct answer/i)).toBeInTheDocument();
  });

  it("does not preselect a correct answer in create mode", () => {
    render(<McqForm mode="create" />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("preselects the existing correct answer in edit mode", () => {
    render(<McqForm mode="edit" mcqId="mcq-1" initialMcq={sampleMcq} />);

    expect(
      screen.getByRole("radio", { name: /mark choice 2 as correct/i })
    ).toBeChecked();
  });

  it("blocks saving when no correct answer is selected", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await user.type(screen.getByLabelText(/name/i), sampleMcq.name);
    await user.type(screen.getByLabelText(/question/i), sampleMcq.question);
    await user.type(screen.getAllByLabelText(/choice text/i)[0], "Mitochondria");
    await user.type(screen.getAllByLabelText(/choice text/i)[1], "Chloroplast");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByText(/select which choice is the correct answer/i)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows adding choices up to six and disables add at the maximum", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    const addButton = screen.getByRole("button", { name: /add choice/i });

    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getAllByLabelText(/choice text/i)).toHaveLength(6);
    expect(addButton).toBeDisabled();
  });

  it("prevents removing choices below two", () => {
    render(<McqForm mode="create" />);

    const removeButtons = screen.getAllByRole("button", { name: /remove choice/i });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeDisabled();
  });

  it("submits create requests to POST /api/mcq", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ mcq: sampleMcq }),
    });

    render(<McqForm mode="create" />);

    await user.type(screen.getByLabelText(/name/i), sampleMcq.name);
    await user.type(screen.getByLabelText(/question/i), sampleMcq.question);
    await user.type(screen.getAllByLabelText(/choice text/i)[0], "Mitochondria");
    await user.type(screen.getAllByLabelText(/choice text/i)[1], "Chloroplast");
    await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sampleMcq.name,
          question: sampleMcq.question,
          choices: [
            { choice: "Mitochondria", isCorrect: false },
            { choice: "Chloroplast", isCorrect: true },
          ],
        }),
      });
      expect(push).toHaveBeenCalledWith("/mcq");
    });
  });

  it("submits edit requests to PUT /api/mcq/[id]", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ mcq: sampleMcq }),
    });

    render(<McqForm mode="edit" mcqId="mcq-1" initialMcq={sampleMcq} />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/mcq/mcq-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sampleMcq.name,
          question: sampleMcq.question,
          choices: [
            { choice: "Mitochondria", isCorrect: false },
            { choice: "Chloroplast", isCorrect: true },
          ],
        }),
      });
      expect(push).toHaveBeenCalledWith("/mcq");
    });
  });

  it("navigates to /mcq when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(push).toHaveBeenCalledWith("/mcq");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows validation errors without calling the API", async () => {
    const user = userEvent.setup();
    render(<McqForm mode="create" />);

    await user.click(screen.getByRole("radio", { name: /mark choice 1 as correct/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/validation failed/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
