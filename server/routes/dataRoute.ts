import { Router, Request, Response } from 'express';
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

router.get('/note/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findWarNote(+req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/reduced_war_data', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findReducedWar();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/asy_application_all', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findAsyApplicationAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/route_death', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findRouteDeath();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/route_IBC_country_list', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findRouteIbcCountryList();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/route_IBC', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await findRouteIbc();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/ingestion-health', getIngestionHealth);

export default router;
