import { Hono } from 'hono';
export const transformers = new Hono();
// Check/gate browser ASR fallback usage
transformers.get('/api/transformers/fallback', async (c) => {
    const disabled = c.env.DISABLE_TRANSFORMERS === '1' || c.env.DISABLE_TRANSFORMERS === true;
    if (disabled)
        return c.json({ allowed: false, reason: 'Browser ASR disabled' }, 503);
    return c.json({ allowed: true });
});
