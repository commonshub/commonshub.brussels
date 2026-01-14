import { describe, test, expect } from '@jest/globals'
import fs from 'fs'
import path from 'path'

describe('Contributors Generation', () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'tests/data')
  const contributorsPath = path.join(DATA_DIR, 'contributors.json')

  test('contributors.json exists', () => {
    expect(fs.existsSync(contributorsPath)).toBe(true)
  })

  test('contributors.json has valid structure', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    expect(data).toHaveProperty('contributors')
    expect(data).toHaveProperty('activeCommoners')
    expect(data).toHaveProperty('totalMembers')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('isMockData')

    expect(Array.isArray(data.contributors)).toBe(true)
    expect(typeof data.activeCommoners).toBe('number')
    expect(typeof data.isMockData).toBe('boolean')
  })

  test('contributors have required fields', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    data.contributors.forEach((contributor: any) => {
      expect(contributor).toHaveProperty('id')
      expect(contributor).toHaveProperty('username')
      expect(contributor).toHaveProperty('displayName')
      expect(contributor).toHaveProperty('avatar')
      expect(contributor).toHaveProperty('contributionCount')
      expect(contributor).toHaveProperty('joinedAt')

      expect(typeof contributor.id).toBe('string')
      expect(typeof contributor.username).toBe('string')
      expect(typeof contributor.displayName).toBe('string')
      expect(typeof contributor.contributionCount).toBe('number')
    })
  })

  test('user 247491094709796865 (Mathieu) has correct guild profile', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))
    const mathieu = data.contributors.find((c: any) => c.id === '247491094709796865')

    expect(mathieu).toBeDefined()

    // Should have guild-specific nickname "Mathieu", not global name "sohokaï"
    expect(mathieu.displayName).toBe('Mathieu')

    // Should have a joinedAt date (first contribution timestamp)
    expect(mathieu.joinedAt).not.toBeNull()
    expect(mathieu.joinedAt).toBeTruthy()

    // Should have contributions
    expect(mathieu.contributionCount).toBeGreaterThan(0)

    console.log('Mathieu profile:', JSON.stringify(mathieu, null, 2))
  })

  test('all contributors with posts have joinedAt', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    const contributorsWithPosts = data.contributors.filter((c: any) => c.contributionCount > 0)
    const contributorsWithNullJoinedAt = contributorsWithPosts.filter((c: any) => !c.joinedAt)

    if (contributorsWithNullJoinedAt.length > 0) {
      console.log('Contributors with posts but null joinedAt:')
      contributorsWithNullJoinedAt.forEach((c: any) => {
        console.log(`  - ${c.displayName} (${c.username}): ${c.contributionCount} contributions`)
      })
    }

    expect(contributorsWithNullJoinedAt.length).toBe(0)
  })

  test('only mentioned users can have null joinedAt', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    const mentionedOnly = data.contributors.filter((c: any) =>
      c.contributionCount === 0 && c.joinedAt === null
    )

    console.log(`${mentionedOnly.length} users were only mentioned (no posts)`)

    mentionedOnly.forEach((c: any) => {
      expect(c.contributionCount).toBe(0)
      // It's okay for mentioned-only users to have null joinedAt
    })
  })

  test('contributors are sorted by contribution count', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    for (let i = 1; i < data.contributors.length; i++) {
      expect(data.contributors[i-1].contributionCount).toBeGreaterThanOrEqual(
        data.contributors[i].contributionCount
      )
    }
  })

  test('top contributor has most contributions', () => {
    const data = JSON.parse(fs.readFileSync(contributorsPath, 'utf-8'))

    expect(data.contributors.length).toBeGreaterThan(0)

    const topContributor = data.contributors[0]
    console.log(`Top contributor: ${topContributor.displayName} with ${topContributor.contributionCount} contributions`)

    expect(topContributor.contributionCount).toBeGreaterThan(0)
  })

  test('file size is optimized (< 50KB)', () => {
    const stats = fs.statSync(contributorsPath)
    const sizeInKB = stats.size / 1024

    console.log(`contributors.json size: ${sizeInKB.toFixed(2)}KB`)

    expect(sizeInKB).toBeLessThan(50)
  })
})
