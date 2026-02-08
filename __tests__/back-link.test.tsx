import { render, screen } from "@testing-library/react";
import { BackLink } from "../components/back-link";

describe("BackLink", () => {
  describe("Rendering", () => {
    it("should render link with href", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });

    it("should render children text", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      expect(screen.getByText("Back to Test")).toBeInTheDocument();
    });

    it("should render SVG arrow icon", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const { container } = render(<BackLink href="/test">Back to Test</BackLink>);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass("w-4", "h-4");
    });

    it("should have correct default classes", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("link-primary", "inline-flex", "items-center", "gap-1");
    });

    it("should merge custom className with default classes", () => {
      render(<BackLink href="/test" className="custom-class">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("link-primary", "inline-flex", "items-center", "gap-1", "custom-class");
    });

    it("should render icon before text", () => {
      const { container } = render(<BackLink href="/test">Back to Test</BackLink>);

      const link = container.querySelector("a");
      const svg = container.querySelector("svg");
      const text = screen.getByText("Back to Test");

      expect(link).toContainElement(svg);
      expect(link).toContainElement(text);
    });
  });

  describe("Accessibility", () => {
    it("should render as link element", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
    });

    it("should be focusable", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link.tagName).toBe("A");
    });
  });

  describe("Props Handling", () => {
    it("should accept href prop", () => {
      render(<BackLink href="/custom/path">Back</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/custom/path");
    });

    it("should accept children prop", () => {
      render(
        <BackLink href="/test">
          <span>Custom Text</span>
        </BackLink>
      );

      expect(screen.getByText("Custom Text")).toBeInTheDocument();
    });

    it("should handle empty className prop", () => {
      render(<BackLink href="/test" className="">Back</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("link-primary", "inline-flex", "items-center", "gap-1");
    });

    it("should handle undefined className prop", () => {
      render(<BackLink href="/test" className={undefined}>Back</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("link-primary", "inline-flex", "items-center", "gap-1");
    });
  });

  describe("SVG Icon", () => {
    it("should have correct fill attribute", () => {
      const { container } = render(<BackLink href="/test">Back</BackLink>);
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("fill", "none");
    });

    it("should have correct stroke attribute", () => {
      const { container } = render(<BackLink href="/test">Back</BackLink>);
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("stroke", "currentColor");
    });

    it("should have correct viewBox", () => {
      const { container } = render(<BackLink href="/test">Back</BackLink>);
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });

    it("should contain path with correct arrow shape", () => {
      const { container } = render(<BackLink href="/test">Back</BackLink>);
      const path = container.querySelector("svg path");

      expect(path).toBeInTheDocument();
      expect(path).toHaveAttribute("d", "M10 19l-7-7m0 0l7-7m-7 7h18");
    });
  });

  describe("Content Layout", () => {
    it("should display icon and text inline", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("inline-flex");
    });

    it("should add gap between icon and text", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("gap-1");
    });

    it("should align items center", () => {
      render(<BackLink href="/test">Back to Test</BackLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("items-center");
    });
  });
});
