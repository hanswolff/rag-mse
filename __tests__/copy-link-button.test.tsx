import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyLinkButton } from "@/components/copy-link-button";

describe("CopyLinkButton", () => {
  const url = "https://rag-mse.de/u/abc12345";

  it("renders the full short link URL in compact mode", () => {
    render(<CopyLinkButton url={url} compact />);

    expect(screen.getByText(url)).toBeInTheDocument();
  });

  it("updates the button state after copying the short link", async () => {
    const user = userEvent.setup();
    render(<CopyLinkButton url={url} />);

    await user.click(screen.getByRole("button", { name: `Kurzlink kopieren: ${url}` }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Kurzlink kopiert" })).toBeInTheDocument());
  });
});
