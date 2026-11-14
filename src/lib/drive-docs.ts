/** Supporting documents in the Accounting Google Drive, by transaction (see src/settings/drive-docs-2023-2024.json). */

import data from "@/settings/drive-docs-2023-2024.json"

const LINKS = (data as { links: Record<string, string[]> }).links

/** "id|amount", the amount as JavaScript prints it rounded to the cent. */
export const docKey = (id: string, amount: number) => `${id}|${Math.round(amount * 100) / 100}`

/** Drive links of a transaction's documents (empty when none is known). */
export function driveDocs(id: string, amount: number): string[] {
  return (LINKS[docKey(id, amount)] ?? []).map((fileId) => `https://drive.google.com/file/d/${fileId}/view`)
}
