import { describe, expect, it } from "vitest";
import { parseUsgsEarthquakes } from "../usgs";

describe("USGS adapter", () => {
  it("parses and sorts GeoJSON features", () => {
    const items = parseUsgsEarthquakes({
      features: [
        { id: "a", properties: { mag: 5, place: "A", time: 1000, url: "u" }, geometry: { coordinates: [0, 0, 10] } },
        { id: "b", properties: { mag: 6, place: "B", time: 2000, url: "u" }, geometry: { coordinates: [0, 0, 20] } },
      ],
    });
    expect(items[0].id).toBe("b");
    expect(items[0].depthKm).toBe(20);
  });
});
