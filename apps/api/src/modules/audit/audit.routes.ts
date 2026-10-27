import { Router } from 'express';

import { UserRole } from '../../generated/prisma/client.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { verifyAuditChain } from './audit.service.js';

export const auditRouter = Router();

auditRouter.get('/verify', authenticate, authorize(UserRole.AUCTIONEER), async (_req, res) => {
  const result = await verifyAuditChain();

  res.status(result.valid ? 200 : 409).json({
    audit: result,
  });
});
