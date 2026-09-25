import { describe, expect, test } from "@jest/globals"
import { donorNames, tidyName } from "@/lib/donors"

describe("donor names", () => {
  test("all-caps bank names are tidied, mixed-case names kept as given", () => {
    expect(tidyName("DAMMAN XAVIER")).toBe("Damman Xavier")
    expect(tidyName("HAIDER-ABIDI S + N")).toBe("Haider-Abidi S + N")
    expect(tidyName("Greg minne Doa consulting")).toBe("Greg minne Doa consulting")
  })

  test("one entry per donor, wallet addresses and form labels left out, sorted", () => {
    expect(
      donorNames([
        "ROEMERS BRUNO",
        "Roemers Bruno",
        "0x27abc2b0dfb20c0314748efad0826266b99d2be0",
        "Financial contribution to openletter",
        null,
        "All for climate",
        "Jana Mehl",
      ]),
    ).toEqual(["All for climate", "Jana Mehl", "Roemers Bruno"])
  })
})
