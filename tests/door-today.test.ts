/**
 * After opening the door from the dashboard, a member sees who came to the
 * hub today: from the door's log, since midnight in Brussels, each person
 * once with their first arrival, a Discord avatar when the door knows one.
 */
import { describe, expect, test } from "@jest/globals"

import { avatarsFromHome, todaysVisitors, type DoorLogEntry } from "@/lib/door-today"

const HOME = `<img class="today-avatar" src="https://cdn.discordapp.com/avatars/618897639836090398/974691a2ce85eb1d10e2cb6f97cbb22d.webp" alt="Avatar">
<img class="avatar" src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp" alt="Avatar">`

const log: DoorLogEntry[] = [
  { timestamp: "2026-10-25T21:30:00Z", status: "granted", name: "Night owl", method: "discord", userId: "1" },
  { timestamp: "2026-10-26T07:37:41Z", status: "granted", name: "Leen", method: "discord", userId: "618897639836090398", username: "leen8610" },
  { timestamp: "2026-10-26T08:10:00Z", status: "denied", name: "Nope", method: "discord", userId: "2" },
  { timestamp: "2026-10-26T09:00:00Z", status: "granted", name: "Leo", method: "signature", reason: "Coworking pass" },
  { timestamp: "2026-10-26T10:00:00Z", status: "granted", name: "Leen", method: "discord", userId: "618897639836090398" },
  { timestamp: "2026-10-26T10:05:00Z", status: "granted", name: "Token User", method: "token" },
  { timestamp: "2026-10-26T11:00:00Z", status: "granted", name: "xdamman", method: "signature", reason: "Member (website)" },
]

describe("todaysVisitors", () => {
  test("today in Brussels, granted only, each once at first arrival, guests marked, me with my avatar", () => {
    const vs = todaysVisitors(log, avatarsFromHome(HOME), new Date("2026-10-26T12:00:00Z"), { username: "xdamman", avatar: "https://cdn/me.png" })
    expect(vs.map((v) => [v.name, new Date(v.arrivedAt).toISOString().slice(11, 16), v.guest, v.avatar])).toEqual([
      ["Leen", "07:37", false, "https://cdn.discordapp.com/avatars/618897639836090398/974691a2ce85eb1d10e2cb6f97cbb22d.png?size=96"],
      ["Leo", "09:00", true, null],
      ["xdamman", "11:00", false, "https://cdn/me.png"],
    ])
  })

  test("21:30 UTC on the 25th is already the 26th in Brussels in summer time", () => {
    const vs = todaysVisitors([{ timestamp: "2026-06-25T22:30:00Z", status: "granted", name: "Early", userId: "9" }], new Map(), new Date("2026-06-26T08:00:00Z"))
    expect(vs.map((v) => v.name)).toEqual(["Early"])
  })
})
