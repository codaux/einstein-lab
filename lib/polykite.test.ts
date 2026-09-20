import { describe, expect, it } from "vitest";
import { enumeratePolykites } from "./polykite";

describe("polykite enumeration", () => {
  it("matches the published free-polykite counts through size 5", () => {
    const expected = [1, 2, 4, 10, 27];
    const actual = expected.map((_, i) => enumeratePolykites(i + 1, 1000).length);
    expect(actual).toEqual(expected);
  });
});
