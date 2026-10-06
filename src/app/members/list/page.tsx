import { permanentRedirect } from "next/navigation"

/** The member list now lives at /members. */
export default function MembersListRedirect() {
  permanentRedirect("/members")
}
