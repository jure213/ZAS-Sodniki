import { z } from 'zod';

// The strict CSP forbids eval; without this zod probes new Function() when
// schemas are created. Must be the FIRST import of the entry module, because
// ES imports are hoisted and evaluated before the entry's own statements.
z.config({ jitless: true });
