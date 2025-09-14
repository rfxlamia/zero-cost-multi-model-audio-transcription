export class Semaphore {
  private queue: Array<() => void> = []
  private active = 0
  constructor(private readonly limit: number) {}

  async acquire() {
    if (this.active < this.limit) {
      this.active++
      return
    }
    await new Promise<void>((resolve) => this.queue.push(resolve))
    this.active++
  }

  release() {
    this.active = Math.max(0, this.active - 1)
    const next = this.queue.shift()
    if (next) next()
  }
}

export const providerSemaphore = new Semaphore(5)

