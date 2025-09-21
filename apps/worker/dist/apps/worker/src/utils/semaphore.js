export class Semaphore {
    limit;
    queue = [];
    active = 0;
    constructor(limit) {
        this.limit = limit;
    }
    async acquire() {
        if (this.active < this.limit) {
            this.active++;
            return;
        }
        await new Promise((resolve) => this.queue.push(resolve));
        this.active++;
    }
    release() {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next)
            next();
    }
}
export const providerSemaphore = new Semaphore(5);
export const kvSemaphore = new Semaphore(5);
