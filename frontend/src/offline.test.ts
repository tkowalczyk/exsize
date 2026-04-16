import { describe, it, expect, beforeAll } from "vitest"
import fs from "fs"
import path from "path"

describe("offline.html", () => {
  let doc: Document

  beforeAll(() => {
    const html = fs.readFileSync(
      path.resolve(__dirname, "../public/offline.html"),
      "utf-8"
    )
    const parser = new DOMParser()
    doc = parser.parseFromString(html, "text/html")
  })

  it("contains ExSize branding", () => {
    const text = doc.body.textContent ?? ""
    expect(text).toContain("ExSize")
  })

  it("shows a no-internet message", () => {
    const text = doc.body.textContent ?? ""
    expect(text).toContain("Brak połączenia")
  })

  it("has a retry button", () => {
    const btn = doc.getElementById("retry-btn")
    expect(btn).not.toBeNull()
    expect(btn!.tagName).toBe("BUTTON")
    expect(btn!.textContent).toContain("Spróbuj ponownie")
  })

  it("retry button disables itself and fetches /api/health on click", () => {
    const scriptEl = doc.querySelector("script:not([src])")
    const scriptText = scriptEl?.textContent ?? ""
    expect(scriptText).toContain('fetch("/api/health"')
    expect(scriptText).toContain("btn.disabled = true")
    expect(scriptText).toContain("location.reload()")
  })

  it("uses app theme colors (primary #1a7a5c, dark bg #0a0a0a)", () => {
    const styleText = doc.querySelector("style")?.textContent ?? ""
    expect(styleText).toContain("#0a0a0a")
    expect(styleText).toContain("#1a7a5c")
  })

  it("displays the ExSize logo image", () => {
    const img = doc.querySelector("img.logo")
    expect(img).not.toBeNull()
    expect(img!.getAttribute("src")).toBe("/pwa-192x192.png")
    expect(img!.getAttribute("alt")).toBe("ExSize")
  })
})
