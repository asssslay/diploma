import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  routeParams,
  getSettingsMock,
  patchSettingsMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  routeParams: {},
  getSettingsMock: vi.fn(),
  patchSettingsMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => routeParams,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      settings: {
        $get: getSettingsMock,
        $patch: patchSettingsMock,
      },
    },
  })),
}));

const settingsResponse = {
  success: true as const,
  data: {
    notifyDeadlineReminders: true,
    notifyEventReminders: false,
  },
};

describe("settings route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the failed state when settings cannot be loaded", async () => {
    getSettingsMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    const { Route } = await import("./settings");
    render(<Route.component />);

    expect(await screen.findByText("Failed to load settings.")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load settings");
  });

  it("updates a setting successfully", async () => {
    getSettingsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(settingsResponse),
    });
    patchSettingsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          notifyDeadlineReminders: false,
          notifyEventReminders: false,
        },
      }),
    });

    const { Route } = await import("./settings");
    render(<Route.component />);

    const deadlineSwitch = await screen.findByRole("switch", {
      name: "Deadline reminders",
    });
    await userEvent.click(deadlineSwitch);

    await waitFor(() => {
      expect(patchSettingsMock).toHaveBeenCalledWith({
        json: { notifyDeadlineReminders: false },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Setting updated");
  });

  it("disables both switches while a save is pending", async () => {
    let resolvePatch!: (value: unknown) => void;
    getSettingsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(settingsResponse),
    });
    patchSettingsMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    );

    const { Route } = await import("./settings");
    render(<Route.component />);

    const deadlineSwitch = await screen.findByRole("switch", {
      name: "Deadline reminders",
    });
    const deadlineInput = screen.getByLabelText("Deadline reminders", {
      selector: "input",
    });
    const eventInput = screen.getByLabelText("Event reminders", {
      selector: "input",
    });

    await userEvent.click(deadlineSwitch);

    await waitFor(() => {
      expect(deadlineInput).toBeDisabled();
      expect(eventInput).toBeDisabled();
    });

    resolvePatch({
      ok: true,
      json: vi.fn().mockResolvedValue(settingsResponse),
    });
  });
});
