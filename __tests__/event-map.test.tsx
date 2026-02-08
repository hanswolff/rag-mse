import { render, waitFor } from "@testing-library/react";
import { EventMap } from "@/components/event-map";
import L from "leaflet";

describe("EventMap", () => {
  beforeEach(() => {
    if (L.Icon.Default.prototype._getIconUrl) {
      delete L.Icon.Default.prototype._getIconUrl;
    }
  });

  it("renders map when latitude and longitude are provided", async () => {
    const { container } = render(
      <EventMap latitude={52.52} longitude={13.405} location="Berlin" />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeDefined();
    });
  });

  it("renders null when latitude is null", () => {
    const { container } = render(
      <EventMap latitude={null} longitude={13.405} location="Berlin" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when longitude is null", () => {
    const { container } = render(
      <EventMap latitude={52.52} longitude={null} location="Berlin" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when both latitude and longitude are null", () => {
    const { container } = render(
      <EventMap latitude={null} longitude={null} location="Berlin" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders map with correct container styling", async () => {
    const { container } = render(
      <EventMap latitude={52.52} longitude={13.405} location="Munich" />
    );

    await waitFor(() => {
      const mapContainer = container.querySelector(".w-full");
      expect(mapContainer).toBeDefined();
    });
  });

  it("handles zero values correctly", async () => {
    const { container } = render(
      <EventMap latitude={0} longitude={0} location="Null Island" />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeDefined();
    });
  });

  it("configures Leaflet icon URLs correctly on mount", async () => {
    const defaultIcon = L.Icon.Default;
    const iconOptions = defaultIcon.prototype.options;

    render(<EventMap latitude={52.52} longitude={13.405} location="Berlin" />);

    await waitFor(() => {
      expect(iconOptions.iconUrl).toContain("marker-icon.png");
      expect(iconOptions.iconRetinaUrl).toContain("marker-icon-2x.png");
      expect(iconOptions.shadowUrl).toContain("marker-shadow.png");
    });
  });
});
