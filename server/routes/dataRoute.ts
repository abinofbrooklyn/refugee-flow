import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  findWarNote,
  findReducedWar,
  findAsyApplicationAll,
  findRouteDeath,
  findRouteIbcCountryList,
  findRouteIbc,
} from '../controllers/api/data/dataController';
import { getIngestionHealth } from '../controllers/api/data/ingestionHealthController';

const router: Router = Router();

// Tight rate limit for ingestion-health (exposes infrastructure details)
export const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

router.get('/note/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findWarNote(+req.params.id);
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reduced_war_data', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findReducedWar();
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/asy_application_all', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findAsyApplicationAll();
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/route_death', async (req: Request, res: Response): Promise<void> => {
  try {
    const route = typeof req.query.route === 'string' ? req.query.route : undefined;
    const data = await findRouteDeath(route);
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/route_IBC_country_list', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findRouteIbcCountryList();
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/route_IBC', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findRouteIbc();
    res.json(data);
  } catch (err) {
    console.error('[API error]', req.path, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/ingestion-health', healthLimiter, getIngestionHealth);

export default router;
