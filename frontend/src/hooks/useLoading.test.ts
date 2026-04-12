import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useLoading } from "./useLoading";

describe("useLoading", () => {
  it("returns initial state with isLoading false, error null, and execute function", () => {
    const { result } = renderHook(() => useLoading());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.execute).toBe("function");
  });

  it("sets isLoading true during async call and false on completion", async () => {
    const { result } = renderHook(() => useLoading());
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });

    act(() => {
      result.current.execute(() => promise);
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!();
      await promise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("captures errors and exposes them via error state", async () => {
    const { result } = renderHook(() => useLoading());

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error("Something went wrong")),
      );
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Something went wrong");
  });

  it("clears error on next successful call", async () => {
    const { result } = renderHook(() => useLoading());

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error("fail")),
      );
    });
    expect(result.current.error).toBe("fail");

    await act(async () => {
      await result.current.execute(() => Promise.resolve());
    });
    expect(result.current.error).toBeNull();
  });
});
