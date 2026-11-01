// 后院棋盘花圃静态数据
export const BACKYARD_BOARD_SIZE = 6

export const backyardBoardCells = Array.from(
  { length: BACKYARD_BOARD_SIZE * BACKYARD_BOARD_SIZE },
  (_, i) => {
    const row = Math.floor(i / BACKYARD_BOARD_SIZE)
    const col = i % BACKYARD_BOARD_SIZE
    return {
      light: (row + col) % 2 === 0,
      hasTop: row > 0,
      hasRight: col < BACKYARD_BOARD_SIZE - 1,
      hasBottom: row < BACKYARD_BOARD_SIZE - 1,
      hasLeft: col > 0,
    }
  }
)

export const BACKYARD_MAX_FLOWERS = 20

// 三消的四条线（行增量, 列增量）
const MATCH_LINES = [
  [0, 1], // 横
  [1, 0], // 竖
  [1, 1], // 主对角
  [1, -1], // 反对角
]

export function findFlowerMatch(filled, index, size = BACKYARD_BOARD_SIZE) {
  const row = Math.floor(index / size)
  const col = index % size
  for (const [dr, dc] of MATCH_LINES) {
    for (let off = -2; off <= 0; off++) {
      const trio = []
      for (let k = 0; k < 3; k++) {
        const r = row + dr * (off + k)
        const c = col + dc * (off + k)
        if (r < 0 || r >= size || c < 0 || c >= size) {
          trio.length = 0
          break
        }
        trio.push(r * size + c)
      }
      if (trio.length === 3 && trio.every((i) => filled.has(i))) return trio
    }
  }
  return null
}

export const backyardBoardDots = Array.from(
  { length: (BACKYARD_BOARD_SIZE - 1) * (BACKYARD_BOARD_SIZE - 1) },
  (_, i) => ({
    key: i,
    x: `${((i % (BACKYARD_BOARD_SIZE - 1) + 1) * 100) / BACKYARD_BOARD_SIZE}%`,
    y: `${((Math.floor(i / (BACKYARD_BOARD_SIZE - 1)) + 1) * 100) / BACKYARD_BOARD_SIZE}%`,
  })
)
