/**
 * In-memory store for user favorites
 * In production, this should be a database
 */

interface Favorite {
  userId: string
  messageId: string
  channelId: string
  addedAt: Date
}

// In-memory store (replace with database in production)
const favorites = new Map<string, Favorite>()

function getFavoriteKey(userId: string, messageId: string): string {
  return `${userId}:${messageId}`
}

export function addFavorite(userId: string, channelId: string, messageId: string): void {
  const key = getFavoriteKey(userId, messageId)
  favorites.set(key, {
    userId,
    messageId,
    channelId,
    addedAt: new Date(),
  })
}

export function removeFavorite(userId: string, messageId: string): void {
  const key = getFavoriteKey(userId, messageId)
  favorites.delete(key)
}

export function isFavorited(userId: string, messageId: string): boolean {
  const key = getFavoriteKey(userId, messageId)
  return favorites.has(key)
}

export function getUserFavorites(userId: string): Favorite[] {
  return Array.from(favorites.values()).filter((fav) => fav.userId === userId)
}

export function getMessageFavorites(messageId: string): Favorite[] {
  return Array.from(favorites.values()).filter((fav) => fav.messageId === messageId)
}
