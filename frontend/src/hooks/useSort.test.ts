import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSort } from "./useSort";

interface Row {
  name: string;
  cpu: number;
}

const rows: Row[] = [
  { name: "b-host", cpu: 10 },
  { name: "a-host", cpu: 80 },
  { name: "c-host", cpu: 40 },
];
const getValue = (r: Row, key: "name" | "cpu") => r[key];

describe("useSort", () => {
  it("sorts by the initial column", () => {
    const { result } = renderHook(() => useSort(rows, getValue, { key: "name", dir: "asc" }));
    expect(result.current.sorted?.map((r) => r.name)).toEqual(["a-host", "b-host", "c-host"]);
  });

  it("flips direction when the same column is clicked again", () => {
    const { result } = renderHook(() => useSort(rows, getValue, { key: "name", dir: "asc" }));
    act(() => result.current.toggle("name", "a-host"));
    expect(result.current.sorted?.map((r) => r.name)).toEqual(["c-host", "b-host", "a-host"]);
  });

  it("starts a number column biggest-first", () => {
    const { result } = renderHook(() => useSort(rows, getValue, { key: "name", dir: "asc" }));
    act(() => result.current.toggle("cpu", 10));
    expect(result.current.sorted?.map((r) => r.cpu)).toEqual([80, 40, 10]);
  });

  it("returns null while data is still loading", () => {
    const { result } = renderHook(() => useSort<Row, "name" | "cpu">(null, getValue, { key: "name", dir: "asc" }));
    expect(result.current.sorted).toBeNull();
  });
});
